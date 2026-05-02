import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Phone, MessageCircle, AlertOctagon, Camera, Share2, Thermometer, Clock, Navigation, Rewind, Square, RefreshCw, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import EmergencySosFab from "@/components/EmergencySosFab";
import ServiceTimeline from "@/components/ServiceTimeline";

const STAGES = [
  { key: "departed", label: "已出发", emoji: "🚗" },
  { key: "picking_up", label: "接宠途中", emoji: "📍" },
  { key: "picked_up", label: "已接收", emoji: "🐾" },
  { key: "delivered", label: "已送达", emoji: "🏠" },
] as const;

interface Tracking {
  id: string;
  order_id: string;
  stage: string;
  driver_lat: number | null;
  driver_lng: number | null;
  distance_km: number | null;
  eta_minutes: number | null;
  cabin_temperature: number | null;
  photo_urls: string[];
  message: string | null;
  updated_at: string;
}

const TripTrackingPage = () => {
  const navigate = useNavigate();
  const { id: orderId } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [order, setOrder] = useState<any>(null);
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [liveTracking, setLiveTracking] = useState<Tracking | null>(null);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<Tracking[]>([]);
  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  const [retryIn, setRetryIn] = useState<number>(30);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const replayRef = useRef<number | null>(null);
  const simRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const retryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!orderId) return;
    let active = true;

    const loadOrder = async () => {
      const { data: ord } = await supabase
        .from("orders")
        .select("id, order_no, pickup_address, dropoff_address, pet_snapshot, service_type")
        .eq("id", orderId)
        .maybeSingle();
      if (!active) return;
      setOrder(ord);
    };

    loadOrder();
    fetchTracking();
    subscribe();

    return () => {
      active = false;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (simRef.current) window.clearInterval(simRef.current);
      if (replayRef.current) window.clearInterval(replayRef.current);
      if (retryTimerRef.current) window.clearInterval(retryTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, user, authLoading]);

  const fetchTracking = async () => {
    if (!orderId) return;
    const { data: tr } = await supabase
      .from("trip_tracking")
      .select("*")
      .eq("order_id", orderId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tr) {
      setTracking(tr as any);
      setLiveTracking(tr as any);
      stopAutoRetry();
    } else {
      startAutoRetry();
    }
  };

  const subscribe = () => {
    if (!orderId) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel(`trip-tracking-${orderId}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_tracking", filter: `order_id=eq.${orderId}` },
        (payload) => {
          if (payload.new) {
            setLiveTracking(payload.new as any);
            setTracking((prev) => (replayRef.current ? prev : (payload.new as any)));
            stopAutoRetry();
          }
        },
      )
      .subscribe();
    channelRef.current = channel;
  };

  const startAutoRetry = () => {
    if (retryTimerRef.current) return;
    setRetryIn(30);
    retryTimerRef.current = window.setInterval(() => {
      setRetryIn((s) => {
        if (s <= 1) {
          handleRetry(true);
          return 30;
        }
        return s - 1;
      });
    }, 1000);
  };

  const stopAutoRetry = () => {
    if (retryTimerRef.current) {
      window.clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const handleRetry = async (auto = false) => {
    setIsRetrying(true);
    setRetryCount((c) => c + 1);
    subscribe();
    await fetchTracking();
    setIsRetrying(false);
    if (!auto) {
      toast({ title: "已重新连接", description: "正在拉取司机最新位置…" });
    }
  };


  // 司机位置进度动画（演示用）
  useEffect(() => {
    if (!tracking) return;
    const target =
      tracking.stage === "departed" ? 25 : tracking.stage === "picking_up" ? 50 : tracking.stage === "picked_up" ? 75 : 100;
    setProgress(0);
    const step = () => setProgress((p) => (p < target ? Math.min(p + 1, target) : p));
    const id = window.setInterval(step, 50);
    return () => window.clearInterval(id);
  }, [tracking?.stage]);

  // 推进阶段：插入新记录（保留历史轨迹用于回放）
  const advanceStage = async () => {
    const base = liveTracking || tracking;
    if (!base) return;
    const idx = STAGES.findIndex((s) => s.key === base.stage);
    if (idx < 0 || idx >= STAGES.length - 1) return;
    const next = STAGES[idx + 1].key;
    const { error } = await supabase.from("trip_tracking").insert({
      order_id: orderId,
      stage: next,
      driver_lat: (base.driver_lat ?? 31.23) + 0.005,
      driver_lng: (base.driver_lng ?? 121.47) + 0.008,
      distance_km: Math.max(0, Number(base.distance_km || 5) - 1.5),
      eta_minutes: Math.max(0, (base.eta_minutes || 15) - 5),
      cabin_temperature: base.cabin_temperature ?? 24,
      message: STAGES[idx + 1].label,
    });
    if (error) toast({ title: "推进失败", description: error.message, variant: "destructive" });
  };

  // 回放最近 10 分钟
  const startReplay = async () => {
    if (!orderId) return;
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("trip_tracking")
      .select("*")
      .eq("order_id", orderId)
      .gte("updated_at", since)
      .order("updated_at", { ascending: true });
    if (error) {
      toast({ title: "加载历史失败", description: error.message, variant: "destructive" });
      return;
    }
    if (!data || data.length < 2) {
      toast({ title: "最近 10 分钟历史不足", description: "请先推进几次阶段再回放" });
      return;
    }
    setHistory(data as any);
    setReplayIdx(0);
    setTracking(data[0] as any);
    if (replayRef.current) window.clearInterval(replayRef.current);
    replayRef.current = window.setInterval(() => {
      setReplayIdx((i) => {
        if (i === null) return null;
        const ni = i + 1;
        if (ni >= data.length) {
          if (replayRef.current) {
            window.clearInterval(replayRef.current);
            replayRef.current = null;
          }
          return i;
        }
        setTracking(data[ni] as any);
        return ni;
      });
    }, 1500);
  };

  const stopReplay = () => {
    if (replayRef.current) {
      window.clearInterval(replayRef.current);
      replayRef.current = null;
    }
    setReplayIdx(null);
    if (liveTracking) setTracking(liveTracking);
  };

  const stageIdx = tracking ? STAGES.findIndex((s) => s.key === tracking.stage) : 0;
  const pet = order?.pet_snapshot;
  const isReplaying = replayIdx !== null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2" aria-label="返回">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">实时追踪</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        {pet && (
          <div className="rounded-xl bg-orange-500/10 border border-orange-500/30 p-3 text-sm flex items-start gap-2">
            <Share2 className="w-4 h-4 text-orange-500 mt-0.5" />
            <div>
              <p className="font-medium">已发送给司机：{pet.name}</p>
              <p className="text-xs text-muted-foreground">
                {pet.allergies?.length > 0 && `过敏：${pet.allergies.join("、")} · `}
                {pet.behavior_notes?.length > 0 && `禁忌：${pet.behavior_notes.join("、")}`}
              </p>
              {pet.trip_note && (
                <p className="text-xs mt-1 text-orange-600 dark:text-orange-400">📝 本次备注：{pet.trip_note}</p>
              )}
            </div>
          </div>
        )}

        {!tracking ? (
          <section className="rounded-2xl border border-dashed border-muted-foreground/30 bg-card p-6 text-center space-y-4 shadow-sm">
            <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <Inbox className="w-7 h-7 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">暂无司机位置</h3>
              <p className="text-sm text-muted-foreground">
                司机还未上报实时位置，可能尚未出发或暂时离线。
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              {isRetrying ? "正在重新连接…" : `${retryIn}s 后自动重试 · 已重试 ${retryCount} 次`}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => toast({ title: "正在拨打司机电话", description: "请耐心等待接听" })}>
                <Phone className="w-4 h-4 mr-1" /> 联系司机
              </Button>
              <Button size="sm" onClick={() => handleRetry(false)} disabled={isRetrying}>
                <RefreshCw className={cn("w-4 h-4 mr-1", isRetrying && "animate-spin")} /> 立即重试
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => toast({ title: "已通知客服", description: "客服将协助您联系司机" })}>
              <MessageCircle className="w-4 h-4 mr-1" /> 联系平台客服
            </Button>
          </section>
        ) : (
        <>
        {/* SVG 地图 */}
        <section className="rounded-2xl border bg-card overflow-hidden shadow-sm">
          <svg viewBox="0 0 360 200" className="w-full h-48 bg-gradient-to-br from-blue-50 to-emerald-50 dark:from-slate-800 dark:to-slate-900">
            {/* 道路 */}
            <path d="M 30 170 Q 120 150 180 100 T 330 30" stroke="hsl(var(--muted-foreground))" strokeWidth="3" fill="none" strokeDasharray="6 4" opacity="0.4" />
            <path d="M 30 170 Q 120 150 180 100 T 330 30" stroke="hsl(var(--primary))" strokeWidth="3" fill="none"
              strokeDasharray="600"
              strokeDashoffset={600 - (progress / 100) * 600} />
            {/* 起点 */}
            <circle cx="30" cy="170" r="8" fill="hsl(var(--primary))" />
            <text x="42" y="174" fontSize="10" fill="hsl(var(--foreground))">起</text>
            {/* 终点 */}
            <circle cx="330" cy="30" r="8" fill="hsl(var(--destructive))" />
            <text x="305" y="22" fontSize="10" fill="hsl(var(--foreground))">终</text>
            {/* 司机车辆位置 */}
            {(() => {
              const t = progress / 100;
              const x = 30 + (330 - 30) * t;
              const y = 170 - Math.sin(t * Math.PI) * 100;
              return (
                <g>
                  <circle cx={x} cy={y} r="14" fill="hsl(var(--primary))" opacity="0.2">
                    <animate attributeName="r" from="14" to="22" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={x} cy={y} r="10" fill="hsl(var(--primary))" />
                  <text x={x} y={y + 4} fontSize="12" textAnchor="middle">🚗</text>
                </g>
              );
            })()}
          </svg>

          {/* 四步进度 */}
          <div className="p-4 space-y-3">
            <Progress value={((stageIdx + 1) / STAGES.length) * 100} />
            <div className="grid grid-cols-4 gap-1 text-center text-[11px]">
              {STAGES.map((s, i) => (
                <div key={s.key} className={cn(i <= stageIdx ? "text-primary font-medium" : "text-muted-foreground")}>
                  <div className="text-base">{s.emoji}</div>
                  {s.label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 实时数值 */}
        <section className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border bg-card p-3 text-center">
            <Navigation className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-xs text-muted-foreground">距离</p>
            <p className="text-sm font-semibold">{tracking?.distance_km?.toFixed(1) ?? "—"} km</p>
          </div>
          <div className="rounded-xl border bg-card p-3 text-center">
            <Clock className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-xs text-muted-foreground">预计到达</p>
            <p className="text-sm font-semibold">{tracking?.eta_minutes ?? "—"} 分钟</p>
          </div>
          <div className="rounded-xl border bg-card p-3 text-center">
            <Thermometer className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-xs text-muted-foreground">车内温度</p>
            <p className="text-sm font-semibold">{tracking?.cabin_temperature ?? "—"}°C</p>
          </div>
        </section>

        {/* 行程照片 */}
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
            <Camera className="w-4 h-4" /> 行程照片更新
          </h3>
          {tracking?.photo_urls && tracking.photo_urls.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {tracking.photo_urls.map((u) => (
                <img key={u} src={u} alt="行程照片" className="aspect-square rounded-lg object-cover" />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">司机还未上传照片</p>
          )}
        </section>
        </>
        )}

        {/* 云陪伴时间轴（实时） */}
        {orderId && <ServiceTimeline orderId={orderId} />}

        {/* 快捷按钮 */}
        <section className="grid grid-cols-3 gap-2">
          <Button variant="outline" className="flex-col h-auto py-3" onClick={() => toast({ title: "拨打司机电话" })}>
            <Phone className="w-5 h-5 mb-1" />
            <span className="text-xs">电话</span>
          </Button>
          <Button variant="outline" className="flex-col h-auto py-3" onClick={() => toast({ title: "进入会话" })}>
            <MessageCircle className="w-5 h-5 mb-1" />
            <span className="text-xs">消息</span>
          </Button>
          <Button variant="destructive" className="flex-col h-auto py-3" onClick={() => toast({ title: "已通知客服紧急介入", variant: "destructive" })}>
            <AlertOctagon className="w-5 h-5 mb-1" />
            <span className="text-xs">紧急</span>
          </Button>
        </section>

        {/* 回放控件 */}
        {isReplaying && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 flex items-center justify-between">
            <div className="text-sm">
              <Badge variant="secondary" className="mr-2">回放中</Badge>
              第 {(replayIdx ?? 0) + 1} / {history.length} 帧 ·{" "}
              {tracking?.updated_at && new Date(tracking.updated_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
            <Button size="sm" variant="outline" onClick={stopReplay}>
              <Square className="w-3.5 h-3.5 mr-1" /> 停止
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={startReplay} disabled={isReplaying}>
            <Rewind className="w-4 h-4 mr-1" /> 回放最近10分钟
          </Button>
          <Button variant="ghost" size="sm" onClick={advanceStage} disabled={isReplaying}>
            ▶ 推进阶段（演示）
          </Button>
        </div>

        {tracking?.stage === "delivered" && orderId && !isReplaying && (
          <Button className="w-full" onClick={() => navigate(`/rate/${orderId}`)}>
            行程已结束 · 去评价 ⭐
          </Button>
        )}
      </main>
      <EmergencySosFab orderId={orderId} />
    </div>
  );
};

export default TripTrackingPage;
