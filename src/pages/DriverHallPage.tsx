import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Navigation, RefreshCw, Loader2, Route as RouteIcon, Clock, Wallet, ChevronDown, Copy } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface HallOrder {
  id: string;
  order_no: string;
  service_type: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  total_amount: number;
  driver_fare: number | null;
  driver_distance_km: number | null;
  booking_date: string | null;
  booking_time: string | null;
  created_at: string;
}

const AVG_SPEED_KMH = 30;
const COMMISSION_RATE = 0.15;
const PER_KM = 2.5;

function fmtETA(km: number | null) {
  if (km == null || km <= 0) return "—";
  const min = Math.max(1, Math.round((km / AVG_SPEED_KMH) * 60));
  return `${min} 分钟`;
}

export default function DriverHallPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<HallOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [grabbing, setGrabbing] = useState<string | null>(null);
  const [confirmOrder, setConfirmOrder] = useState<(HallOrder & { km: number | null; grossFare: number; net: number }) | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const lockRef = useRef<Set<string>>(new Set());

  const load = async (preserveScroll = false) => {
    const scrollY = preserveScroll ? window.scrollY : 0;
    setLoading(true);
    const [{ data: pool }, { data: mine }] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_no, service_type, pickup_address, dropoff_address, total_amount, driver_fare, driver_distance_km, booking_date, booking_time, created_at")
        .is("driver_id", null)
        .in("order_status", ["pending", "created", "confirmed"])
        .in("service_type", ["pickup", "delivery"])
        .order("created_at", { ascending: false })
        .limit(40),
      user
        ? supabase
            .from("orders")
            .select("id")
            .eq("driver_id", user.id)
            .in("order_status", ["accepted", "in_progress"])
            .limit(20)
        : Promise.resolve({ data: [] as { id: string }[] }),
    ]);
    setOrders((pool as HallOrder[]) ?? []);
    setTaken(((mine as { id: string }[]) ?? []).map((o) => o.id));
    setLoading(false);
    if (preserveScroll) {
      requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("hall-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load(true))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const enriched = useMemo(
    () =>
      orders.map((o) => {
        const km = o.driver_distance_km ?? null;
        const grossFare =
          Number(o.driver_fare) > 0
            ? Number(o.driver_fare)
            : Number(o.total_amount) > 0
              ? Number(o.total_amount)
              : km != null
                ? Math.max(15, Math.round(km * PER_KM * 100) / 100)
                : 0;
        const net = +(grossFare * (1 - COMMISSION_RATE)).toFixed(2);
        return { ...o, km, grossFare, net };
      }),
    [orders],
  );

  const grab = async (id: string) => {
    if (!user) return;
    if (lockRef.current.has(id)) return;
    lockRef.current.add(id);
    setGrabbing(id);
    setConfirmOrder(null);
    const { data, error } = await (supabase as any).rpc("driver_grab_order", { _order_id: id });
    setGrabbing(null);
    lockRef.current.delete(id);
    if (error || !data?.success) {
      toast({
        title: "抢单失败",
        description:
          data?.error === "already_taken"
            ? "订单已被其他司机接走"
            : data?.error === "not_a_provider"
              ? "您当前没有接单权限"
              : data?.error || error?.message,
        variant: "destructive",
      });
      load(true);
      return;
    }
    toast({ title: "接单成功", description: "已为您打开实时追踪" });
    navigate(`/track/${id}`);
  };

  const copySummary = async (o: HallOrder & { km: number | null; net: number; grossFare: number }) => {
    const text = [
      `【订单 ${o.order_no}】`,
      `类型：${o.service_type === "delivery" ? "送宠" : "接宠"}`,
      `起：${o.pickup_address || "—"}`,
      `终：${o.dropoff_address || "—"}`,
      `距离：${o.km != null ? `${o.km.toFixed(1)} km` : "—"} · 预计 ${fmtETA(o.km)}`,
      `毛收入：¥${o.grossFare.toFixed(2)} · 净收益：¥${o.net.toFixed(2)}（扣 15% 平台佣金）`,
      o.booking_date ? `预约：${o.booking_date} ${o.booking_time ?? ""}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "已复制订单摘要" });
    } catch {
      toast({ title: "复制失败", description: "请手动选择文本复制", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-40 bg-card border-b px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary" aria-label="返回">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-extrabold flex-1">接单大厅</h1>
        <button onClick={() => load(true)} className="p-1.5 rounded-lg hover:bg-secondary" aria-label="刷新">
          <RefreshCw className="w-5 h-5" />
        </button>
      </header>

      <main className="px-4 py-4 max-w-lg mx-auto space-y-3">
        {taken.length > 0 && (
          <section className="rounded-2xl bg-primary/5 border border-primary/20 p-3 text-sm flex items-center justify-between">
            <span className="font-semibold text-primary">您当前有 {taken.length} 单进行中</span>
            <Button size="sm" variant="outline" onClick={() => navigate(`/track/${taken[0]}`)}>
              继续行程
            </Button>
          </section>
        )}

        {loading ? (
          <div className="flex justify-center py-12 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : enriched.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">暂无可接订单，稍候自动刷新…</p>
        ) : (
          enriched.map((o) => {
            const expanded = expandedId === o.id;
            const isLocked = grabbing === o.id || lockRef.current.has(o.id);
            return (
              <article key={o.id} className="rounded-2xl bg-card p-4 card-shadow space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{o.service_type === "delivery" ? "送宠" : "接宠"}</Badge>
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">待接单</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{o.order_no}</span>
                </div>

                <div className="space-y-1 text-sm">
                  <p className="flex items-start gap-1.5">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className={expanded ? "" : "truncate"}>起 · {o.pickup_address || "—"}</span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <Navigation className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <span className={expanded ? "" : "truncate"}>终 · {o.dropoff_address || "—"}</span>
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-2.5 text-center">
                  <div>
                    <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                      <RouteIcon className="w-3 h-3" /> 距离
                    </div>
                    <p className="text-sm font-bold tabular-nums">
                      {o.km != null ? `${o.km.toFixed(1)} km` : "—"}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="w-3 h-3" /> 预计
                    </div>
                    <p className="text-sm font-bold tabular-nums">{fmtETA(o.km)}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                      <Wallet className="w-3 h-3" /> 净收益
                    </div>
                    <p className="text-sm font-extrabold text-primary tabular-nums">¥{o.net.toFixed(2)}</p>
                  </div>
                </div>

                {(o.booking_date || o.booking_time) && (
                  <p className="text-xs text-muted-foreground">
                    预约 {o.booking_date} {o.booking_time}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : o.id)}
                  className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1"
                  aria-expanded={expanded}
                >
                  {expanded ? "收起路线详情" : "查看路线详情"}
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-180")} />
                </button>

                {expanded && (
                  <div className="rounded-xl border border-dashed bg-muted/30 p-3 space-y-2 text-xs">
                    <div>
                      <p className="font-semibold text-foreground mb-1">完整路线</p>
                      <p>起点：{o.pickup_address || "—"}</p>
                      <p>终点：{o.dropoff_address || "—"}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">计算口径</p>
                      <p>毛收入 = max(司机基础费, 订单总额, 距离 × ¥{PER_KM}/km)</p>
                      <p>预计耗时 = 距离 ÷ {AVG_SPEED_KMH}km/h（城市平均车速）</p>
                      <p>
                        <b>净收益 = 毛收入 × (1 − {Math.round(COMMISSION_RATE * 100)}% 平台佣金)</b>
                      </p>
                      <p className="mt-1 tabular-nums text-muted-foreground">
                        本单：¥{o.grossFare.toFixed(2)} × {1 - COMMISSION_RATE} = ¥{o.net.toFixed(2)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => copySummary(o)}>
                      <Copy className="w-3.5 h-3.5 mr-1" /> 复制订单摘要
                    </Button>
                  </div>
                )}

                <Button
                  variant="hero"
                  className={cn("w-full", isLocked && "pointer-events-none opacity-70")}
                  disabled={isLocked}
                  aria-disabled={isLocked}
                  onClick={() => setConfirmOrder(o)}
                >
                  {isLocked ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  一键接单 · ¥{o.net.toFixed(2)}
                </Button>
              </article>
            );
          })
        )}
      </main>

      <AlertDialog open={!!confirmOrder} onOpenChange={(o) => !o && setConfirmOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认接下这一单？</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmOrder && (
                <>
                  路线约 <b>{confirmOrder.km != null ? `${confirmOrder.km.toFixed(1)} km` : "—"}</b>，
                  预计耗时 <b>{fmtETA(confirmOrder.km)}</b>，
                  税后净收益约 <b className="text-primary">¥{confirmOrder.net.toFixed(2)}</b>。
                  接单后订单将进入「进行中」，请尽快前往接送地点。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>再看看</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!grabbing}
              onClick={() => confirmOrder && grab(confirmOrder.id)}
            >
              确认接单
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}
