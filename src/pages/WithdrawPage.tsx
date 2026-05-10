import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const STATUS_STEPS = ["pending", "approved", "paid"] as const;
const STATUS_LABEL: Record<string, string> = { pending: "申请中", approved: "银行处理中", paid: "已到账", rejected: "已驳回", flagged: "复核中" };

const WithdrawPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [bal, setBal] = useState({ available: 0, frozen: 0, withdrawn_total: 0 });
  const [reqs, setReqs] = useState<any[]>([]);
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState({ bank_name: "", account_no: "", account_name: "" });

  const fee = Math.round(Number(amount || 0) * 0.006 * 100) / 100;
  const actual = Math.max(0, Number(amount || 0) - fee);

  const load = async () => {
    if (!user) return;
    const [{ data: b }, { data: rs }] = await Promise.all([
      supabase.from("provider_balances").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("withdrawal_requests").select("*").eq("user_id", user.id).order("requested_at", { ascending: false }).limit(20),
    ]);
    if (b) setBal({ available: Number((b as any).available), frozen: Number((b as any).frozen), withdrawn_total: Number((b as any).withdrawn_total) });
    setReqs((rs as any[]) || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast({ title: "请输入金额", variant: "destructive" }); return; }
    if (amt > bal.available) { toast({ title: "金额超过可用余额", variant: "destructive" }); return; }
    if (!bank.account_no.trim()) { toast({ title: "请填写银行卡号", variant: "destructive" }); return; }
    const { data, error } = await supabase.rpc("provider_request_withdrawal" as any, { _amount: amt, _bank_info: bank });
    if (error || (data as any)?.success === false) {
      toast({ title: "申请失败", description: error?.message || (data as any)?.error, variant: "destructive" });
    } else {
      toast({ title: "申请已提交" }); setAmount(""); load();
    }
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate(-1)} aria-label="返回" className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-lg font-semibold">收益与提现</h1>
        </div>
      </header>
      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3"><Wallet className="w-5 h-5 text-primary" /><span className="font-medium">我的钱包</span></div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-[10px] text-muted-foreground">可用</p><p className="font-bold">¥{bal.available.toFixed(2)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">冻结中</p><p className="font-bold text-amber-500">¥{bal.frozen.toFixed(2)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">累计已提</p><p className="font-bold text-emerald-500">¥{bal.withdrawn_total.toFixed(2)}</p></div>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <p className="font-medium">申请提现</p>
          <div><Label>金额 (¥)</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`最多 ${bal.available.toFixed(2)}`} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>开户行</Label><Input value={bank.bank_name} onChange={(e) => setBank({ ...bank, bank_name: e.target.value })} placeholder="工商银行" /></div>
            <div><Label>户名</Label><Input value={bank.account_name} onChange={(e) => setBank({ ...bank, account_name: e.target.value })} placeholder="张三" /></div>
            <div className="col-span-2"><Label>银行卡号</Label><Input value={bank.account_no} onChange={(e) => setBank({ ...bank, account_no: e.target.value })} placeholder="6222 ****" /></div>
          </div>
          <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>提现金额</span><span>¥{Number(amount || 0).toFixed(2)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>手续费 (0.6%)</span><span>- ¥{fee.toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold border-t pt-1"><span>实际到账</span><span>¥{actual.toFixed(2)}</span></div>
          </div>
          <Button className="w-full" onClick={submit} disabled={!amount}>提交申请</Button>
        </Card>

        <div className="space-y-2">
          <p className="font-medium text-sm">提现记录</p>
          {reqs.length === 0 ? <p className="text-center text-muted-foreground text-sm py-4">暂无</p>
            : reqs.map((r) => {
              const idx = STATUS_STEPS.indexOf(r.status);
              return (
                <Card key={r.id} className="p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">¥{Number(r.amount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(r.requested_at).toLocaleString()}</p>
                    </div>
                    <Badge variant={r.status === "paid" ? "secondary" : r.status === "rejected" ? "destructive" : "outline"}>
                      {STATUS_LABEL[r.status]}
                    </Badge>
                  </div>
                  {idx >= 0 && (
                    <div className="flex items-center gap-1">
                      {STATUS_STEPS.map((s, i) => (
                        <div key={s} className={`flex-1 h-1.5 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`} />
                      ))}
                    </div>
                  )}
                  {r.reject_reason && <p className="text-xs text-destructive">{r.reject_reason}</p>}
                  {r.voucher_no && <p className="text-xs text-muted-foreground">凭证 {r.voucher_no}</p>}
                </Card>
              );
            })}
        </div>
      </main>
    </div>
  );
};

export default WithdrawPage;
