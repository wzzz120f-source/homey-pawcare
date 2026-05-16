import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Navigation, RefreshCw, Loader2, Route as RouteIcon, Clock, Wallet, PawPrint, Scissors, Car } from "lucide-react";
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
import { useUserRoles } from "@/hooks/useUserRoles";
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

const ROLE_SERVICES: Record<string, { types: string[]; label: string; icon: any }> = {
  driver: { types: ["pickup", "delivery"], label: "接送单", icon: Car },
  sitter: { types: ["walk", "feed"], label: "上门单", icon: PawPrint },
  groomer: { types: ["groom"], label: "洗护单", icon: Scissors },
};

const SVC_LABEL: Record<string, string> = {
  pickup: "接宠", delivery: "送宠", walk: "遛狗", feed: "喂宠", groom: "洗护",
};

function fmtETA(km: number | null) {
  if (km == null || km <= 0) return "—";
  const min = Math.max(1, Math.round((km / AVG_SPEED_KMH) * 60));
  return `${min} 分钟`;
}

export default function DriverHallPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { roles, activeRole } = useUserRoles();
  const { toast } = useToast();
  const [orders, setOrders] = useState<HallOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [grabbing, setGrabbing] = useState<string | null>(null);
  const [confirmOrder, setConfirmOrder] = useState<(HallOrder & { net: number }) | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  const lockRef = useRef<Set<string>>(new Set());

  // figure out which role tab is active in hall
  const workerRoles = useMemo(
    () => (["driver", "sitter", "groomer"] as const).filter((r) => roles.includes(r)),
    [roles]
  );
  const [tab, setTab] = useState<string>("");
  useEffect(() => {
    if (!tab && workerRoles.length) {
      setTab(workerRoles.includes(activeRole as any) ? (activeRole as string) : workerRoles[0]);
    }
  }, [workerRoles, activeRole, tab]);

  const services = ROLE_SERVICES[tab]?.types ?? [];

  const load = async (preserveScroll = false) => {
    if (!services.length) { setOrders([]); setLoading(false); return; }
    const scrollY = preserveScroll ? window.scrollY : 0;
    setLoading(true);
    const [{ data: pool }, { data: mine }] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_no, service_type, pickup_address, dropoff_address, total_amount, driver_fare, driver_distance_km, booking_date, booking_time, created_at")
        .is("provider_id", null)
        .eq("order_status", "pending_accept")
        .in("service_type", services)
        .order("created_at", { ascending: false })
        .limit(40),
      user
        ? supabase
            .from("orders")
            .select("id")
            .eq("provider_id", user.id)
            .in("order_status", ["accepted", "on_the_way", "serving", "awaiting_confirm"])
            .limit(20)
        : Promise.resolve({ data: [] as { id: string }[] }),
    ]);
    setOrders((pool as HallOrder[]) ?? []);
    setTaken(((mine as { id: string }[]) ?? []).map((o) => o.id));
    setLoading(false);
    if (preserveScroll) requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`hall-orders-${tab}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load(true))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tab]);

  const enriched = useMemo(
    () =>
      orders.map((o) => {
        const gross = Number(o.driver_fare) > 0 ? Number(o.driver_fare) : Number(o.total_amount) || 0;
        return { ...o, net: +(gross * (1 - COMMISSION_RATE)).toFixed(2) };
      }),
    [orders],
  );

  const grab = async (id: string) => {
    if (!user) return;
    if (lockRef.current.has(id)) return;
    lockRef.current.add(id);
    setGrabbing(id);
    setConfirmOrder(null);
    const { data, error } = await (supabase as any).rpc("worker_grab_order", { _order_id: id });
    setGrabbing(null);
    lockRef.current.delete(id);
    if (error || !data?.success) {
      toast({
        title: "接单失败",
        description:
          data?.error === "already_taken" ? "订单已被其他服务者接走"
          : data?.error === "role_mismatch" ? `需要 ${data.required} 角色才能接此单`
          : data?.error || error?.message,
        variant: "destructive",
      });
      load(true);
      return;
    }
    toast({ title: "接单成功", description: "请前往订单详情开始服务" });
    navigate(`/order/${id}`);
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">请先登录</div>;
  if (!workerRoles.length) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-muted-foreground">您还没有服务者身份</p>
        <Button variant="hero" onClick={() => navigate("/apply/sitter")}>立即申请入驻</Button>
      </div>
    );
  }

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

      {workerRoles.length > 1 && (
        <div className="bg-card border-b px-4 py-2 flex gap-2 overflow-x-auto">
          {workerRoles.map((r) => {
            const meta = ROLE_SERVICES[r];
            const Icon = meta.icon;
            const active = tab === r;
            return (
              <button
                key={r}
                onClick={() => setTab(r)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border",
                  active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" /> {meta.label}
              </button>
            );
          })}
        </div>
      )}

      <main className="px-4 py-4 max-w-lg mx-auto space-y-3">
        {taken.length > 0 && (
          <section className="rounded-2xl bg-primary/5 border border-primary/20 p-3 text-sm flex items-center justify-between">
            <span className="font-semibold text-primary">您当前有 {taken.length} 单进行中</span>
            <Button size="sm" variant="outline" onClick={() => navigate(`/order/${taken[0]}`)}>
              继续服务
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
            const isLocked = grabbing === o.id || lockRef.current.has(o.id);
            return (
              <article key={o.id} className="rounded-2xl bg-card p-4 card-shadow space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{SVC_LABEL[o.service_type || ""] || o.service_type}</Badge>
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">待接单</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{o.order_no}</span>
                </div>

                <div className="space-y-1 text-sm">
                  <p className="flex items-start gap-1.5">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="truncate">{o.pickup_address || "—"}</span>
                  </p>
                  {o.dropoff_address && (
                    <p className="flex items-start gap-1.5">
                      <Navigation className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span className="truncate">终 · {o.dropoff_address}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-2.5 text-center">
                  <div>
                    <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><RouteIcon className="w-3 h-3" /> 距离</div>
                    <p className="text-sm font-bold tabular-nums">{o.driver_distance_km != null ? `${o.driver_distance_km.toFixed(1)} km` : "—"}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><Clock className="w-3 h-3" /> 预计</div>
                    <p className="text-sm font-bold tabular-nums">{fmtETA(o.driver_distance_km)}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><Wallet className="w-3 h-3" /> 净收益</div>
                    <p className="text-sm font-extrabold text-primary tabular-nums">¥{o.net.toFixed(2)}</p>
                  </div>
                </div>

                {(o.booking_date || o.booking_time) && (
                  <p className="text-xs text-muted-foreground">预约 {o.booking_date} {o.booking_time}</p>
                )}

                <Button
                  variant="hero"
                  className={cn("w-full", isLocked && "pointer-events-none opacity-70")}
                  disabled={isLocked}
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
                <>税后净收益约 <b className="text-primary">¥{confirmOrder.net.toFixed(2)}</b>，接单后请尽快开始服务。</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>再看看</AlertDialogCancel>
            <AlertDialogAction disabled={!!grabbing} onClick={() => confirmOrder && grab(confirmOrder.id)}>
              确认接单
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}
