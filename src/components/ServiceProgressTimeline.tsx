import { useState } from "react";
import { Check, Loader2, CreditCard, UserCheck, Truck, PawPrint, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  orderId: string;
  status: string;
  isOwner: boolean;
  isProvider: boolean;
  onChanged?: () => void;
}

// canonical order for display
const STEPS = [
  { key: "paid", label: "已支付", icon: CreditCard, match: (s: string) => ["paid","pending_accept","accepted","on_the_way","serving","awaiting_confirm","completed"].includes(s) },
  { key: "pending_accept", label: "等待接单", icon: Loader2, match: (s: string) => ["pending_accept","accepted","on_the_way","serving","awaiting_confirm","completed"].includes(s) },
  { key: "accepted", label: "已接单", icon: UserCheck, match: (s: string) => ["accepted","on_the_way","serving","awaiting_confirm","completed"].includes(s) },
  { key: "on_the_way", label: "已出发", icon: Truck, match: (s: string) => ["on_the_way","serving","awaiting_confirm","completed"].includes(s) },
  { key: "serving", label: "服务中", icon: PawPrint, match: (s: string) => ["serving","awaiting_confirm","completed"].includes(s) },
  { key: "awaiting_confirm", label: "待确认", icon: ShieldCheck, match: (s: string) => ["awaiting_confirm","completed"].includes(s) },
  { key: "completed", label: "已完成", icon: Star, match: (s: string) => s === "completed" },
];

export default function ServiceProgressTimeline({ orderId, status, isOwner, isProvider, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const call = async (rpc: string, args: any, msg: string) => {
    setBusy(rpc);
    const { data, error } = await (supabase as any).rpc(rpc, args);
    setBusy(null);
    if (error || !data?.success) {
      toast.error(data?.error || error?.message || "操作失败");
      return;
    }
    toast.success(msg);
    onChanged?.();
  };

  const providerActions = () => {
    if (!isProvider) return null;
    if (status === "accepted") return (
      <Button variant="hero" disabled={!!busy} className="w-full" onClick={() => call("worker_update_progress", { _order_id: orderId, _to_status: "on_the_way" }, "已标记出发")}>
        我已出发
      </Button>
    );
    if (status === "on_the_way") return (
      <Button variant="hero" disabled={!!busy} className="w-full" onClick={() => call("worker_update_progress", { _order_id: orderId, _to_status: "serving" }, "服务开始")}>
        到达 · 开始服务
      </Button>
    );
    if (status === "serving") return (
      <Button variant="hero" disabled={!!busy} className="w-full" onClick={() => call("worker_update_progress", { _order_id: orderId, _to_status: "awaiting_confirm" }, "已提交完成")}>
        服务完成 · 提交确认
      </Button>
    );
    return null;
  };

  const ownerActions = () => {
    if (!isOwner) return null;
    if (status === "awaiting_confirm") return (
      <div className="space-y-2">
        <Button variant="hero" disabled={!!busy} className="w-full" onClick={() => call("user_confirm_complete", { _order_id: orderId }, "已确认并结算")}>
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
          确认完成并结算
        </Button>
        <p className="text-[11px] text-muted-foreground text-center">48 小时内未确认将自动结算给服务者</p>
      </div>
    );
    return null;
  };

  return (
    <section className="bg-card rounded-2xl p-5 card-shadow">
      <h2 className="font-bold text-base mb-4">服务履约进度</h2>
      <div className="space-y-3 mb-4">
        {STEPS.map((step) => {
          const done = step.match(status);
          const Icon = step.icon;
          const current = step.key === status;
          return (
            <div key={step.key} className="flex items-center gap-3">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                current && "ring-2 ring-primary/40"
              )}>
                {done && !current ? <Check className="w-4 h-4" /> : <Icon className={cn("w-4 h-4", current && step.key === "pending_accept" && "animate-spin")} />}
              </div>
              <span className={cn("text-sm", done ? "text-foreground font-medium" : "text-muted-foreground", current && "text-primary font-bold")}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      {providerActions()}
      {ownerActions()}
    </section>
  );
}
