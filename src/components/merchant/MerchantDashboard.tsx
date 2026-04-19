import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, ShoppingBag, Trophy } from "lucide-react";

interface Props {
  merchantId: string;
}

interface TopItem {
  product_id: string | null;
  product_name: string;
  cover_image: string | null;
  qty: number;
  revenue: number;
}

const MerchantDashboard = ({ merchantId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [todayCount, setTodayCount] = useState(0);
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [topItems, setTopItems] = useState<TopItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data, error } = await supabase
        .from("order_items")
        .select("product_id, product_name, cover_image, unit_price, quantity, created_at, order_id")
        .eq("merchant_id", merchantId);

      if (cancelled) return;
      if (error) {
        setLoading(false);
        return;
      }

      const items = data || [];

      // 今日订单数（去重 order_id）
      const todayOrders = new Set<string>();
      let monthRev = 0;
      const productMap = new Map<string, TopItem>();

      for (const it of items) {
        const created = it.created_at as string;
        if (created >= todayStart) todayOrders.add(it.order_id as string);
        if (created >= monthStart) monthRev += Number(it.unit_price) * Number(it.quantity);

        const key = (it.product_id as string) || (it.product_name as string);
        const existing = productMap.get(key);
        const qty = Number(it.quantity);
        const rev = Number(it.unit_price) * qty;
        if (existing) {
          existing.qty += qty;
          existing.revenue += rev;
        } else {
          productMap.set(key, {
            product_id: it.product_id as string | null,
            product_name: it.product_name as string,
            cover_image: it.cover_image as string | null,
            qty,
            revenue: rev,
          });
        }
      }

      const top = Array.from(productMap.values())
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      setTodayCount(todayOrders.size);
      setMonthRevenue(monthRev);
      setTopItems(top);
      setLoading(false);
    };
    if (merchantId) load();
    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-primary/15 to-primary/5 rounded-2xl p-4 card-shadow">
          <div className="flex items-center gap-2 text-primary">
            <ShoppingBag className="w-4 h-4" />
            <span className="text-xs font-medium">今日订单</span>
          </div>
          <p className="text-3xl font-extrabold mt-2 text-foreground">{todayCount}</p>
          <p className="text-xs text-muted-foreground mt-1">单</p>
        </div>
        <div className="bg-gradient-to-br from-secondary/40 to-secondary/10 rounded-2xl p-4 card-shadow">
          <div className="flex items-center gap-2 text-foreground/70">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium">本月销售额</span>
          </div>
          <p className="text-3xl font-extrabold mt-2 text-foreground">¥{monthRevenue.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground mt-1">含已支付订单</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-4 card-shadow">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm">最热销 Top 5</h3>
        </div>
        {topItems.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">暂无销售数据</p>
        ) : (
          <div className="space-y-2">
            {topItems.map((it, idx) => (
              <div key={it.product_id || it.product_name} className="flex items-center gap-3 py-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  idx === 0 ? "bg-amber-400 text-amber-950" :
                  idx === 1 ? "bg-zinc-300 text-zinc-800" :
                  idx === 2 ? "bg-orange-300 text-orange-900" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {idx + 1}
                </div>
                {it.cover_image ? (
                  <img src={it.cover_image} alt={it.product_name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{it.product_name}</p>
                  <p className="text-xs text-muted-foreground">售出 {it.qty} 件</p>
                </div>
                <span className="text-sm font-bold text-primary">¥{it.revenue.toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MerchantDashboard;
