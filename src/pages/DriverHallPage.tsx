import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Navigation, RefreshCw, Loader2 } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  booking_date: string | null;
  booking_time: string | null;
  created_at: string;
}

export default function DriverHallPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<HallOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [grabbing, setGrabbing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("id, order_no, service_type, pickup_address, dropoff_address, total_amount, driver_fare, booking_date, booking_time, created_at")
      .is("driver_id", null)
      .in("order_status", ["pending", "created", "confirmed"])
      .in("service_type", ["pickup", "delivery"])
      .order("created_at", { ascending: false })
      .limit(40);
    setOrders((data as HallOrder[]) ?? []);
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
  }, []);

  const grab = async (id: string) => {
    if (!user) return;
    setGrabbing(id);
    const { data, error } = await (supabase as any).rpc("driver_grab_order", { _order_id: id });
    setGrabbing(null);
    if (error || !data?.success) {
      toast({
        title: "抢单失败",
        description: data?.error === "already_taken" ? "订单已被其他司机接走" : data?.error || error?.message,
        variant: "destructive",
      });
      load();
      return;
    }
    toast({ title: "接单成功", description: "前往实时追踪" });
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
        {loading ? (
          <div className="flex justify-center py-12 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">暂无可接订单，稍候自动刷新…</p>
        ) : (
          orders.map((o) => {
            const fare = Number(o.driver_fare ?? o.total_amount ?? 0);
            return (
              <article key={o.id} className="rounded-2xl bg-card p-4 card-shadow space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{o.service_type === "delivery" ? "送宠" : "接宠"}</Badge>
                  <span className="text-lg font-extrabold text-primary tabular-nums">¥{fare.toFixed(2)}</span>
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">单号 {o.order_no}</p>
                <div className="space-y-1 text-sm">
                  <p className="flex items-start gap-1">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="truncate">起 · {o.pickup_address || "—"}</span>
                  </p>
                  <p className="flex items-start gap-1">
                    <Navigation className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <span className="truncate">终 · {o.dropoff_address || "—"}</span>
                  </p>
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
                  onClick={() => grab(o.id)}
                >
                  {grabbing === o.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  立即抢单
                </Button>
              </article>
            );
          })
        )}
      </main>

      <BottomNav />
    </div>
  );
}
