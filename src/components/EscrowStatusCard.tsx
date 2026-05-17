import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, CheckCircle2, RotateCcw, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LedgerEntry {
  id: string;
  action: string;
  amount: number;
  note: string | null;
  created_at: string;
}

interface Props {
  orderId: string;
  escrowStatus: string | null | undefined;
  orderStatus: string | null | undefined;
  amount: number | null | undefined;
  refundAmount?: number | null;
  onReleased?: () => void;
}

const ACTION_LABEL: Record<string, string> = {
  hold: "担保锁定",
  release: "释放结算",
  refund: "全额退款",
  partial_refund: "部分退款",
  cancel_unheld: "未担保取消",
};

const STATUS_META: Record<string, { label: string; tone: string; icon: React.ComponentType<{ className?: string }> }> = {
  held: { label: "担保中", tone: "bg-amber-500/10 text-amber-700 border-amber-300", icon: ShieldCheck },
  released: { label: "已结算", tone: "bg-emerald-500/10 text-emerald-700 border-emerald-300", icon: CheckCircle2 },
  released_partial: { label: "部分结算", tone: "bg-sky-500/10 text-sky-700 border-sky-300", icon: RotateCcw },
  refunded: { label: "已退款", tone: "bg-blue-500/10 text-blue-700 border-blue-300", icon: RotateCcw },
  failed: { label: "已关闭", tone: "bg-rose-500/10 text-rose-700 border-rose-300", icon: XCircle },
};

export default function EscrowStatusCard({ orderId, escrowStatus, orderStatus, amount, refundAmount, onReleased }: Props) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    if (!orderId) return;
    (async () => {
      const { data } = await supabase
        .from("escrow_ledger")
        .select("id,action,amount,note,created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      setLedger((data as LedgerEntry[]) ?? []);
    })();
  }, [orderId, escrowStatus]);

  if (!escrowStatus || escrowStatus === "none") return null;
  const meta = STATUS_META[escrowStatus] ?? STATUS_META.held;
  const Icon = meta.icon;

  const total = Number(amount ?? 0);
  const refunded = Number(refundAmount ?? 0);
  const released = ledger.filter(l => l.action === "release").reduce((s, l) => s + Number(l.amount || 0), 0);
  const remaining = Math.max(total - refunded - released, 0);

  const canRelease = escrowStatus === "held" && (orderStatus === "completed" || orderStatus === "done");

  const onRelease = async () => {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("release_escrow", { _order_id: orderId });
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.error === "order_not_completed" ? "服务未完成，暂不能释放" : "释放失败，请稍后再试");
      return;
    }
    toast.success("已确认完成，款项已释放给服务者");
    onReleased?.();
  };

  return (
    <section className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Icon className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <div className="flex items-center gap-2">
            <p className="font-bold text-emerald-900">担保支付保障</p>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${meta.tone}`}>{meta.label}</span>
          </div>
          <div className="mt-1 text-xs text-emerald-900/80 grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span>原担保：¥{total.toFixed(2)}</span>
            <span>已退款：¥{refunded.toFixed(2)}</span>
            <span>已结算：¥{released.toFixed(2)}</span>
            <span>剩余担保：¥{remaining.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {canRelease && (
        <Button variant="hero" size="sm" className="w-full" onClick={onRelease} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          确认完成 · 释放款项 ¥{remaining.toFixed(2)}
        </Button>
      )}

      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between text-xs text-emerald-800 hover:text-emerald-900 transition"
        aria-expanded={open}
      >
        <span>资金流水（{ledger.length}）</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <ol className="space-y-2 border-t border-emerald-500/20 pt-2">
          {ledger.length === 0 && <li className="text-xs text-emerald-900/60">暂无流水</li>}
          {ledger.map(l => (
            <li key={l.id} className="text-xs flex items-start gap-2">
              <span className="shrink-0 w-2 h-2 mt-1.5 rounded-full bg-emerald-500" />
              <div className="flex-1">
                <div className="flex justify-between">
                  <span className="font-medium text-emerald-900">{ACTION_LABEL[l.action] ?? l.action}</span>
                  <span className={l.action.includes("refund") ? "text-blue-700" : "text-emerald-700"}>
                    {l.action.includes("refund") ? "-" : "+"}¥{Number(l.amount).toFixed(2)}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-900/60">
                  {new Date(l.created_at).toLocaleString("zh-CN")}{l.note ? ` · ${l.note}` : ""}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
