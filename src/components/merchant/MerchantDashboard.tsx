import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, ShoppingBag, Trophy, RotateCcw } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

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

type RangeKey = "day" | "week";

const MerchantDashboard = ({ merchantId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("day");
  const [items, setItems] = useState<any[]>([]);
  const [refundedOrderIds, setRefundedOrderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data } = await supabase
        .from("order_items")
        .select("product_id, product_name, cover_image, unit_price, quantity, created_at, order_id")
        .eq("merchant_id", merchantId)
        .gte("created_at", since.toISOString());
      if (cancelled) return;
      const list = data || [];
      setItems(list);

      const ids = Array.from(new Set(list.map((i) => i.order_id as string)));
      if (ids.length) {
        const { data: ords } = await supabase
          .from("orders")
          .select("id,status")
          .in("id", ids);
        if (!cancelled) {
          setRefundedOrderIds(
            new Set((ords || []).filter((o: any) => ["refunded", "refund"].includes(o.status)).map((o: any) => o.id)),
          );
        }
      } else {
        setRefundedOrderIds(new Set());
      }
      setLoading(false);
    };
    if (merchantId) load();
    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  const { metrics, chartData, top } = useMemo(() => {
    const now = new Date();
    const periodMs = range === "day" ? 24 * 3600 * 1000 : 7 * 24 * 3600 * 1000;
    const buckets = range === "day" ? 7 : 4; // last 7 days OR last 4 weeks
    const start = new Date(now.getTime() - buckets * periodMs);

    const inRange = items.filter((it) => new Date(it.created_at) >= start);

    const orderSet = new Set<string>();
    let revenue = 0;
    let refundCount = 0;
    const productMap = new Map<string, TopItem>();
    const series: { label: string; revenue: number; orders: number }[] = [];

    for (let i = 0; i < buckets; i++) {
      const bStart = new Date(now.getTime() - (buckets - i) * periodMs);
      const bEnd = new Date(now.getTime() - (buckets - 1 - i) * periodMs);
      const label =
        range === "day"
          ? `${bStart.getMonth() + 1}/${bStart.getDate()}`
          : `W${Math.ceil(bStart.getDate() / 7)}`;
      const bOrders = new Set<string>();
      let bRev = 0;
      inRange.forEach((it) => {
        const t = new Date(it.created_at);
        if (t >= bStart && t < bEnd) {
          bOrders.add(it.order_id);
          bRev += Number(it.unit_price) * Number(it.quantity);
        }
      });
      series.push({ label, revenue: Math.round(bRev), orders: bOrders.size });
    }

    inRange.forEach((it) => {
      orderSet.add(it.order_id);
      revenue += Number(it.unit_price) * Number(it.quantity);
      const key = (it.product_id as string) || (it.product_name as string);
      const ex = productMap.get(key);
      const qty = Number(it.quantity);
      const rev = Number(it.unit_price) * qty;
      if (ex) {
        ex.qty += qty;
        ex.revenue += rev;
      } else {
        productMap.set(key, {
          product_id: it.product_id,
          product_name: it.product_name,
          cover_image: it.cover_image,
          qty,
          revenue: rev,
        });
      }
    });
    orderSet.forEach((id) => {
      if (refundedOrderIds.has(id)) refundCount++;
    });

    const refundRate = orderSet.size ? (refundCount / orderSet.size) * 100 : 0;

    return {
      metrics: { orders: orderSet.size, revenue, refundRate },
      chartData: series,
      top: Array.from(productMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 5),
    };
  }, [items, range, refundedOrderIds]);

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">营业看板</p>
        <ToggleGroup
          type="single"
          size="sm"
          value={range}
          onValueChange={(v) => v && setRange(v as RangeKey)}
        >
          <ToggleGroupItem value="day" className="text-xs px-3">按日</ToggleGroupItem>
          <ToggleGroupItem value="week" className="text-xs px-3">按周</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl p-3 card-shadow bg-gradient-to-br from-primary/15 to-primary/5">
          <ShoppingBag className="w-4 h-4 text-primary" />
          <p className="text-[11px] text-muted-foreground mt-1">订单数</p>
          <p className="text-xl font-extrabold text-foreground tabular-nums">{metrics.orders}</p>
        </div>
        <div className="rounded-2xl p-3 card-shadow bg-gradient-to-br from-primary/15 to-primary/5">
          <TrendingUp className="w-4 h-4 text-primary" />
          <p className="text-[11px] text-muted-foreground mt-1">成交额</p>
          <p className="text-xl font-extrabold text-foreground tabular-nums">¥{metrics.revenue.toFixed(0)}</p>
        </div>
        <div className="rounded-2xl p-3 card-shadow bg-gradient-to-br from-destructive/15 to-destructive/5">
          <RotateCcw className="w-4 h-4 text-destructive" />
          <p className="text-[11px] text-muted-foreground mt-1">退款率</p>
          <p className="text-xl font-extrabold text-foreground tabular-nums">{metrics.refundRate.toFixed(1)}%</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-4 card-shadow">
        <p className="text-sm font-bold mb-2">{range === "day" ? "近 7 天成交额" : "近 4 周成交额"}</p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: any) => [`¥${v}`, "成交额"]}
              />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="hsl(var(--primary))" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-4 card-shadow">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm">最热销 Top 5</h3>
        </div>
        {top.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">暂无销售数据</p>
        ) : (
          <div className="space-y-2">
            {top.map((it, idx) => (
              <div key={it.product_id || it.product_name} className="flex items-center gap-3 py-1.5">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    idx === 0
                      ? "bg-primary text-primary-foreground"
                      : idx === 1
                        ? "bg-primary/70 text-primary-foreground"
                        : idx === 2
                          ? "bg-primary/40 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                  }`}
                >
                  {idx + 1}
                </div>
                {it.cover_image ? (
                  <img src={it.cover_image} alt={it.product_name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{it.product_name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">售出 {it.qty} 件</p>
                </div>
                <span className="text-sm font-bold text-primary tabular-nums">¥{it.revenue.toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MerchantDashboard;
