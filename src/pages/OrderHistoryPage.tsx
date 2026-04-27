import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Repeat, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import { cn } from "@/lib/utils";

type FilterKey = "all" | "completed" | "cancelled" | "pet";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "completed", label: "已完成" },
  { key: "cancelled", label: "已取消" },
  { key: "pet", label: "按宠物" },
];

interface Order {
  id: string;
  order_no: string;
  order_status: string;
  service_type: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  total_amount: number;
  created_at: string;
  pet_snapshot: any;
  pet_type: string | null;
}

const OrderHistoryPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [petFilter, setPetFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    setLoading(true);
    supabase
      .from("orders")
      .select("id, order_no, order_status, service_type, pickup_address, dropoff_address, total_amount, created_at, pet_snapshot, pet_type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setOrders((data || []) as any);
        setLoading(false);
      });
  }, [user, authLoading]);

  const petOptions = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      const n = o.pet_snapshot?.name || o.pet_type;
      if (n) set.add(n);
    });
    return Array.from(set);
  }, [orders]);

  const filtered = useMemo(() => {
    let list = orders;
    if (filter === "completed") list = list.filter((o) => o.order_status === "completed");
    else if (filter === "cancelled") list = list.filter((o) => o.order_status === "cancelled");
    else if (filter === "pet" && petFilter) list = list.filter((o) => (o.pet_snapshot?.name || o.pet_type) === petFilter);
    return list;
  }, [orders, filter, petFilter]);

  const popularRoutes = useMemo(() => {
    const counts = new Map<string, { from: string; to: string; count: number }>();
    orders.forEach((o) => {
      if (o.pickup_address && o.dropoff_address) {
        const k = `${o.pickup_address}→${o.dropoff_address}`;
        counts.set(k, { from: o.pickup_address, to: o.dropoff_address, count: (counts.get(k)?.count || 0) + 1 });
      }
    });
    return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 3);
  }, [orders]);

  const reuse = (o: Order) => {
    navigate("/booking", {
      state: {
        prefill: {
          pickup_address: o.pickup_address,
          dropoff_address: o.dropoff_address,
          pet_snapshot: o.pet_snapshot,
          service_type: o.service_type,
        },
      },
    });
  };

  const reuseRoute = (from: string, to: string) => {
    navigate("/booking", { state: { prefill: { pickup_address: from, dropoff_address: to } } });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2" aria-label="返回">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">历史订单</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* 筛选 */}
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setFilter(f.key);
                if (f.key !== "pet") setPetFilter(null);
              }}
              className={cn(
                "px-3 py-1.5 text-sm rounded-full border whitespace-nowrap",
                filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filter === "pet" && petOptions.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {petOptions.map((p) => (
              <button
                key={p}
                onClick={() => setPetFilter(p)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs border",
                  petFilter === p ? "bg-secondary text-secondary-foreground" : "bg-background",
                )}
              >
                🐾 {p}
              </button>
            ))}
          </div>
        )}

        {/* 订单列表 */}
        {loading ? (
          <div className="text-center text-muted-foreground py-12">加载中…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">暂无订单</div>
        ) : (
          filtered.map((o) => (
            <article key={o.id} className="rounded-2xl border bg-card p-4 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{o.order_no}</span>
                <Badge variant={o.order_status === "completed" ? "secondary" : o.order_status === "cancelled" ? "outline" : "default"}>
                  {o.order_status}
                </Badge>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="truncate">{o.pickup_address || "—"}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
                  <span className="truncate">{o.dropoff_address || "—"}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(o.created_at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="font-semibold text-foreground">¥{Number(o.total_amount).toFixed(2)}</span>
              </div>
              {o.pet_snapshot?.name && (
                <div className="text-xs text-muted-foreground">🐾 {o.pet_snapshot.name}</div>
              )}
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => navigate(`/order/${o.id}`)}>
                  查看详情
                </Button>
                <Button size="sm" className="flex-1 gap-1" onClick={() => reuse(o)}>
                  <Repeat className="w-3.5 h-3.5" /> 再来一单 ↗
                </Button>
              </div>
            </article>
          ))
        )}

        {/* 常用路线 */}
        {popularRoutes.length > 0 && (
          <section className="rounded-2xl border bg-gradient-to-br from-primary/5 to-amber-500/5 p-4 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-amber-500" /> 常用路线 · 一键下单
            </h2>
            {popularRoutes.map((r, i) => (
              <button
                key={i}
                onClick={() => reuseRoute(r.from, r.to)}
                className="w-full text-left rounded-xl bg-card border p-3 hover:bg-muted transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">使用 {r.count} 次</span>
                  <Badge variant="outline" className="text-[10px]">高频</Badge>
                </div>
                <p className="text-sm truncate">📍 {r.from}</p>
                <p className="text-sm truncate">🏁 {r.to}</p>
              </button>
            ))}
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default OrderHistoryPage;
