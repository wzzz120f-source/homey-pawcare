import { useState } from "react";
import { ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  orderId: string;
  escrowStatus: string | null | undefined;
  orderStatus: string | null | undefined;
  amount: number | null | undefined;
  onReleased?: () => void;
}

export default function EscrowStatusCard({ orderId, escrowStatus, orderStatus, amount, onReleased }: Props) {
  const [busy, setBusy] = useState(false);
  if (!escrowStatus || escrowStatus === "none") return null;

  const released = escrowStatus === "released";
  const refunded = escrowStatus === "refunded";
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
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <p className="font-bold text-emerald-900">担保支付保障</p>
          {released ? (
            <p className="text-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />款项 ¥{amount?.toFixed(2) ?? "—"} 已结算给服务者
            </p>
          ) : refunded ? (
            <p className="text-emerald-800">款项已退回到您的账户</p>
          ) : (
            <p className="text-emerald-800">您支付的 ¥{amount?.toFixed(2) ?? "—"} 由平台暂存，服务完成并经您确认后再结算。</p>
          )}
        </div>
      </div>
      {canRelease && (
        <Button variant="hero" size="sm" className="w-full" onClick={onRelease} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          确认完成 · 释放款项 ¥{amount?.toFixed(2) ?? "—"}
        </Button>
      )}
    </section>
  );
}
