import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Navigation, RefreshCw, Loader2, Route as RouteIcon, Clock, Wallet } from "lucide-react";
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

const AVG_SPEED_KMH = 30;          // 城市平均车速估算
const COMMISSION_RATE = 0.15;       // 司机净收益估算（扣 15% 平台）
const PER_KM = 2.5;                 // 距离系数（兜底估算）

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
  const [confirmOrder, setConfirmOrder] = useState<HallOrder | null>(null);
  const [taken, setTaken] = useState<string[]>([]); // 我接到的当前活跃单

  const load = async () => {
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
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("hall-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
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
    setGrabbing(id);
    setConfirmOrder(null);
    const { data, error } = await (supabase as any).rpc("driver_grab_order", { _order_id: id });
    setGrabbing(null);
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
      load();
      return;
    }
    toast({ title: "接单成功", description: "已为您打开实时追踪" });
    navigate(`/track/${id}`);
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-40 bg-card border-b px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary" aria-label="返回">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-extrabold flex-1">接单大厅</h1>
        <button onClick={load} className="p-1.5 rounded-lg hover:bg-secondary" aria-label="刷新">
          <RefreshCw className="w-5 h-5" />
        </button>
      </header>

      <main className="px-4 py-4 max-w-lg mx-auto space-y-3">
        {/* 我的进行中 */}
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
          enriched.map((o) => (
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
                  <span className="truncate">起 · {o.pickup_address || "—"}</span>
                </p>
                <p className="flex items-start gap-1.5">
                  <Navigation className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  <span className="truncate">终 · {o.dropoff_address || "—"}</span>
                </p>
              </div>

              {/* 路线 + 时间 + 收益 */}
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

              <Button
                variant="hero"
                className="w-full"
                disabled={grabbing === o.id}
                onClick={() => setConfirmOrder(o)}
              >
                {grabbing === o.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                一键接单 · ¥{o.net.toFixed(2)}
              </Button>
            </article>
          ))
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
            <AlertDialogAction onClick={() => confirmOrder && grab(confirmOrder.id)}>
              确认接单
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}
