import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, Loader2, Package, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RefundRow {
  id: string;
  payment_id: string;
  order_id: string;
  user_id: string;
  amount: number;
  reason: string | null;
  status: string;
  refund_type: string;
  created_at: string;
  operator_note: string | null;
  orders?: { order_no: string; is_physical: boolean; payment_method: string | null } | null;
  payments?: { channel: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "待审核",
  approved: "已批准（处理中）",
  succeeded: "已退款",
  rejected: "已驳回",
};

const AdminRefundsPage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("payment_refunds")
      .select("*, orders(order_no, is_physical, payment_method), payments(channel)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter === "pending") q = q.eq("status", "pending");
    const { data, error } = await q;
    if (error) {
      toast.error("加载失败：" + error.message);
    } else {
      setRows((data ?? []) as any);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [filter]);

  const handle = async (id: string, action: "approve" | "reject") => {
    const note = action === "reject" ? window.prompt("驳回原因（必填）：") : window.prompt("审核备注（可选）：") ?? "";
    if (action === "reject" && !note) return;
    setProcessing(id);
    const { data, error } = await supabase.rpc("process_refund", { _refund_id: id, _action: action, _note: note });
    setProcessing(null);
    if (error) { toast.error(error.message); return; }
    const r = data as any;
    if (!r?.success) { toast.error(r?.error ?? "处理失败"); return; }

    // 非钱包渠道，approve 后调 refund-payment 调渠道接口
    if (action === "approve" && r.channel && r.channel !== "wallet" && r.channel !== "mock") {
      const { error: e2 } = await supabase.functions.invoke("refund-payment", { body: { refund_id: id } });
      if (e2) toast.error("渠道退款调用失败：" + e2.message);
      else toast.success("已批准并提交渠道退款");
    } else {
      toast.success(action === "approve" ? "已批准退款" : "已驳回");
    }
    await load();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14 max-w-3xl mx-auto">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-secondary" aria-label="返回">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-extrabold text-lg flex-1">退款审核</h1>
          <button onClick={load} className="p-2 rounded-full hover:bg-secondary" aria-label="刷新">
            <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
          </button>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-3 flex gap-2">
          {(["pending", "all"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium",
                filter === k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              )}
            >
              {k === "pending" ? "待审核" : "全部"}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin inline" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">暂无{filter === "pending" ? "待处理" : ""}退款</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="bg-card rounded-2xl p-4 card-shadow space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {r.orders?.is_physical ? <Package className="w-4 h-4 text-amber-600" /> : <Sparkles className="w-4 h-4 text-primary" />}
                  <span className="font-semibold text-sm">{r.orders?.order_no ?? r.order_id.slice(0, 8)}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {r.orders?.is_physical ? "实物" : "虚拟"}·{r.refund_type === "auto" ? "自动" : "人工"}
                  </span>
                </div>
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  r.status === "pending" ? "bg-amber-100 text-amber-700" :
                  r.status === "succeeded" ? "bg-green-100 text-green-700" :
                  r.status === "rejected" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                )}>{STATUS_LABELS[r.status] ?? r.status}</span>
              </div>
              <div className="text-sm grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">渠道：</span>{r.payments?.channel ?? "—"}</div>
                <div><span className="text-muted-foreground">金额：</span><span className="font-bold text-primary">¥{Number(r.amount).toFixed(2)}</span></div>
              </div>
              {r.reason && <div className="text-sm"><span className="text-muted-foreground">原因：</span>{r.reason}</div>}
              {r.operator_note && <div className="text-xs text-muted-foreground">备注：{r.operator_note}</div>}
              <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("zh-CN")}</div>
              {r.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="hero" size="sm" className="flex-1"
                    disabled={processing === r.id}
                    onClick={() => handle(r.id, "approve")}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />批准
                  </Button>
                  <Button
                    variant="outline" size="sm" className="flex-1"
                    disabled={processing === r.id}
                    onClick={() => handle(r.id, "reject")}
                  >
                    <XCircle className="w-4 h-4 mr-1" />驳回
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
};

export default AdminRefundsPage;
