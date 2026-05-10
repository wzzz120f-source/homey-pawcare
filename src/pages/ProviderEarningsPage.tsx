import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, Coins, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Earning {
  id: string;
  gross: number;
  commission: number;
  net: number;
  order_id: string | null;
  created_at: string;
  role: string;
}

const ProviderEarningsPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [bal, setBal] = useState({ available: 0, frozen: 0, withdrawn_total: 0 });
  const [list, setList] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    void load();
  }, [user, authLoading]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [b, e] = await Promise.all([
      supabase.from("provider_balances").select("available,frozen,withdrawn_total").eq("user_id", user.id).maybeSingle(),
      supabase.from("earning_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (b.data) setBal({
      available: Number((b.data as any).available ?? 0),
      frozen: Number((b.data as any).frozen ?? 0),
      withdrawn_total: Number((b.data as any).withdrawn_total ?? 0),
    });
    setList((e.data as any) || []);
    setLoading(false);
  };

  const monthGross = list.filter(x => new Date(x.created_at).getMonth() === new Date().getMonth())
    .reduce((s, x) => s + Number(x.net), 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="min-w-[40px] min-h-[40px] -ml-2 flex items-center justify-center rounded-full hover:bg-secondary" aria-label="返回">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-extrabold flex-1">我的收益</h1>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        <div className="rounded-2xl p-5 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg">
          <p className="text-sm opacity-90 flex items-center gap-1.5"><Coins className="w-4 h-4" />可提现余额</p>
          {loading ? <Skeleton className="h-10 w-40 mt-2 bg-white/30" /> : (
            <p className="text-4xl font-extrabold mt-2">¥{bal.available.toFixed(2)}</p>
          )}
          <div className="flex gap-4 mt-3 text-xs opacity-90">
            <span>冻结中：¥{bal.frozen.toFixed(2)}</span>
            <span>累计提现：¥{bal.withdrawn_total.toFixed(2)}</span>
          </div>
          <Button variant="secondary" className="w-full mt-4" onClick={() => navigate("/worker/withdraw")}>
            <ArrowUpFromLine className="w-4 h-4 mr-1" />立即提现
          </Button>
        </div>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /><span className="font-bold">本月净收入</span></div>
            <span className="text-xl font-extrabold text-primary">¥{monthGross.toFixed(2)}</span>
          </div>
        </Card>

        <div>
          <h2 className="font-bold mb-2">收益明细</h2>
          {loading ? [...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl mb-2" />)
            : list.length === 0 ? <p className="text-center text-muted-foreground py-12 text-sm">暂无收益记录</p>
            : list.map((e) => (
              <div key={e.id} className="bg-card border border-border rounded-xl p-3 mb-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">订单收入</span>
                  <span className="text-emerald-600 font-extrabold">+¥{Number(e.net).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>毛收入 ¥{Number(e.gross).toFixed(2)} - 平台抽成 ¥{Number(e.commission).toFixed(2)}</span>
                  <span>{new Date(e.created_at).toLocaleDateString("zh-CN")}</span>
                </div>
                {e.order_id && (
                  <button onClick={() => navigate(`/order/${e.order_id}`)} className="text-xs text-primary hover:underline">
                    查看订单 →
                  </button>
                )}
              </div>
            ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default ProviderEarningsPage;
