import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Activity, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const LABELS: Record<string, string> = {
  profiles_total: "用户总数",
  banned_total: "封禁用户",
  orders_24h: "24h 订单",
  orders_failed_24h: "24h 取消订单",
  payments_pending: "待支付",
  payments_paid_24h: "24h 已支付",
  withdrawals_pending: "待审核提现",
  kyc_pending: "待审核 KYC",
  rescue_pending: "待审核救助",
  violations_24h: "24h 违规拦截",
  admin_actions_24h: "24h 后台操作",
};

const DevHealthPage = () => {
  const [data, setData] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const { data: r } = await supabase.rpc("dev_health_overview");
    setData((r as any) || null);
    setLoading(false);
  };
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate("/__dev/console")} aria-label="返回" className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-lg font-semibold flex-1 flex items-center gap-2"><Activity className="w-5 h-5 text-primary" />系统健康</h1>
          <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-4">
        {loading && !data ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(LABELS).map(([k, label]) => (
              <Card key={k} className="p-4">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-2xl font-bold mt-1">{data?.[k] ?? "—"}</div>
              </Card>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground text-center mt-4">每 10 秒自动刷新</p>
      </main>
    </div>
  );
};

export default DevHealthPage;
