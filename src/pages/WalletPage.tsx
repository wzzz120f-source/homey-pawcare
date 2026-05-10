import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Tx {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  recharge: "充值", pay: "支付", refund: "退款",
};

const WalletPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [balance, setBalance] = useState(0);
  const [frozen, setFrozen] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [rechargeAmt, setRechargeAmt] = useState<number>(50);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    void load();
  }, [user, authLoading]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [w, t] = await Promise.all([
      supabase.from("user_wallets").select("balance,frozen").eq("user_id", user.id).maybeSingle(),
      supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setBalance(Number(w.data?.balance ?? 0));
    setFrozen(Number(w.data?.frozen ?? 0));
    setTxs((t.data as any) || []);
    setLoading(false);
  };

  const recharge = async () => {
    if (rechargeAmt <= 0) { toast.error("请输入金额"); return; }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("wallet_recharge", { _amount: rechargeAmt, _channel: "微信支付" });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.success) { toast.success(`充值成功，余额 ¥${(data as any).balance}`); void load(); }
    else toast.error((data as any)?.error || "充值失败");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="min-w-[40px] min-h-[40px] -ml-2 flex items-center justify-center rounded-full hover:bg-secondary" aria-label="返回">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-extrabold flex-1">我的钱包</h1>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        <div className="rounded-2xl p-5 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg">
          <div className="flex items-center gap-2 text-sm opacity-90"><WalletIcon className="w-4 h-4" />当前余额</div>
          {loading ? <Skeleton className="h-10 w-40 mt-2 bg-white/30" /> : (
            <p className="text-4xl font-extrabold mt-2">¥{balance.toFixed(2)}</p>
          )}
          <p className="text-xs opacity-80 mt-1">冻结中：¥{frozen.toFixed(2)}</p>
        </div>

        <Tabs defaultValue="recharge">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="recharge"><ArrowDownToLine className="w-4 h-4 mr-1" />充值</TabsTrigger>
            <TabsTrigger value="history"><ArrowUpFromLine className="w-4 h-4 mr-1" />明细</TabsTrigger>
          </TabsList>

          <TabsContent value="recharge" className="space-y-3 mt-3">
            <div className="grid grid-cols-4 gap-2">
              {[50, 100, 200, 500].map((n) => (
                <button key={n} onClick={() => setRechargeAmt(n)}
                  className={cn("rounded-xl border-2 py-3 font-bold text-sm transition-all",
                    rechargeAmt === n ? "border-primary bg-primary/10 text-primary" : "border-border bg-card")}>
                  ¥{n}
                </button>
              ))}
            </div>
            <Input type="number" value={rechargeAmt} onChange={(e) => setRechargeAmt(Number(e.target.value))} placeholder="自定义金额" />
            <Button className="w-full" onClick={recharge} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              充值 ¥{rechargeAmt}
            </Button>
            <p className="text-xs text-muted-foreground text-center">充值即代表同意《钱包服务协议》。本操作通过模拟支付完成。</p>
          </TabsContent>

          <TabsContent value="history" className="space-y-2 mt-3">
            {loading ? [...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
              : txs.length === 0 ? <p className="text-center text-muted-foreground py-12 text-sm">暂无流水</p>
              : txs.map((t) => (
                <div key={t.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{TYPE_LABEL[t.type] || t.type}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(t.created_at).toLocaleString("zh-CN")}</p>
                  </div>
                  <div className={cn("font-extrabold text-base shrink-0", t.amount > 0 ? "text-emerald-600" : "text-foreground")}>
                    {t.amount > 0 ? "+" : ""}¥{Number(t.amount).toFixed(2)}
                  </div>
                </div>
              ))}
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />
    </div>
  );
};

export default WalletPage;
