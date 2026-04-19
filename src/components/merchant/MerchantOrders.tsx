import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  merchantId: string;
}

interface MerchantOrderRow {
  order_id: string;
  order_no: string;
  buyer_id: string;
  buyer_name: string;
  total_amount: number;
  order_status: string;
  payment_status: string;
  created_at: string;
  items: { name: string; qty: number; price: number }[];
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  created: { label: "待支付", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  confirmed: { label: "待发货", cls: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300" },
  in_progress: { label: "已发货", cls: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
  completed: { label: "已完成", cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  cancelled: { label: "已取消", cls: "bg-destructive/10 text-destructive" },
};

const MerchantOrders = ({ merchantId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MerchantOrderRow[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: itemRows, error } = await supabase
      .from("order_items")
      .select("order_id, product_name, quantity, unit_price")
      .eq("merchant_id", merchantId);

    if (error) {
      toast.error("加载订单失败：" + error.message);
      setLoading(false);
      return;
    }

    const orderIds = Array.from(new Set((itemRows || []).map((r: any) => r.order_id)));
    if (orderIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: orders } = await supabase
      .from("orders")
      .select("id, order_no, user_id, total_amount, order_status, payment_status, created_at")
      .in("id", orderIds)
      .order("created_at", { ascending: false });

    const buyerIds = Array.from(new Set((orders || []).map((o: any) => o.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", buyerIds);
    const nameMap = new Map<string, string>((profiles || []).map((p: any) => [p.user_id, p.username]));

    const itemsByOrder = new Map<string, { name: string; qty: number; price: number }[]>();
    for (const r of itemRows || []) {
      const list = itemsByOrder.get(r.order_id as string) || [];
      list.push({
        name: r.product_name as string,
        qty: Number(r.quantity),
        price: Number(r.unit_price),
      });
      itemsByOrder.set(r.order_id as string, list);
    }

    const result: MerchantOrderRow[] = (orders || []).map((o: any) => ({
      order_id: o.id,
      order_no: o.order_no,
      buyer_id: o.user_id,
      buyer_name: nameMap.get(o.user_id) || "宠物主人",
      total_amount: Number(o.total_amount),
      order_status: o.order_status,
      payment_status: o.payment_status,
      created_at: o.created_at,
      items: itemsByOrder.get(o.id) || [],
    }));

    setRows(result);
    setLoading(false);
  };

  useEffect(() => {
    if (merchantId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  const handleShip = async (orderId: string) => {
    setUpdating(orderId);
    const { error } = await supabase
      .from("orders")
      .update({ order_status: "in_progress" })
      .eq("id", orderId);
    if (error) {
      toast.error("发货失败：" + error.message);
    } else {
      toast.success("已发货，订单状态已更新");
      setRows((prev) => prev.map((r) => (r.order_id === orderId ? { ...r, order_status: "in_progress" } : r)));
    }
    setUpdating(null);
  };

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        暂无订单记录
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const sb = STATUS_MAP[r.order_status] || { label: r.order_status, cls: "bg-muted" };
        const canShip = r.order_status === "confirmed" && r.payment_status === "paid";
        return (
          <div key={r.order_id} className="bg-card rounded-2xl p-4 card-shadow space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">{r.order_no}</span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", sb.cls)}>{sb.label}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              买家：{r.buyer_name} · {format(new Date(r.created_at), "MM-dd HH:mm")}
            </div>
            <ul className="text-sm space-y-1">
              {r.items.map((it, i) => (
                <li key={i} className="flex justify-between">
                  <span className="truncate flex-1 text-foreground">{it.name} ×{it.qty}</span>
                  <span className="text-muted-foreground">¥{(it.price * it.qty).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-xs text-muted-foreground">合计</span>
              <span className="text-primary font-extrabold">¥{r.total_amount.toFixed(2)}</span>
            </div>
            {canShip && (
              <Button size="sm" className="w-full gap-1" onClick={() => handleShip(r.order_id)} disabled={updating === r.order_id}>
                {updating === r.order_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                标记为已发货
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MerchantOrders;
