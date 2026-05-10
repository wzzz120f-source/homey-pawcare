import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

const AdminDashboardPage = () => {
  const [stats, setStats] = useState({ totalRevenue: 0, totalCommission: 0, pendingWithdraw: 0, frozen: 0, pendingApps: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [earn, bal, wPending, drv, mer] = await Promise.all([
        supabase.from("earning_transactions").select("gross,commission"),
        supabase.from("provider_balances").select("frozen"),
        supabase.from("withdrawal_requests").select("amount").eq("status", "pending"),
        supabase.from("driver_applications").select("id").eq("status", "pending"),
        supabase.from("merchant_applications").select("id").eq("status", "pending"),
      ]);
      const firstErr = [earn, bal, wPending, drv, mer].find((r) => r.error)?.error;
      if (firstErr) throw firstErr;
      setStats({
        totalRevenue: (earn.data || []).reduce((s, r: any) => s + Number(r.gross || 0), 0),
        totalCommission: (earn.data || []).reduce((s, r: any) => s + Number(r.commission || 0), 0),
        pendingWithdraw: (wPending.data || []).reduce((s, r: any) => s + Number(r.amount || 0), 0),
        frozen: (bal.data || []).reduce((s, r: any) => s + Number(r.frozen || 0), 0),
        pendingApps: (drv.data?.length || 0) + (mer.data?.length || 0),
      });
    } catch (e: any) {
      setError(e?.message || "加载失败");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const fmt = (n: number) => `¥${n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const cards = [
    { label: "平台总流水", value: fmt(stats.totalRevenue) },
    { label: "累计佣金收入", value: fmt(stats.totalCommission) },
    { label: "待结算（冻结）", value: fmt(stats.frozen) },
    { label: "待打款金额", value: fmt(stats.pendingWithdraw) },
    { label: "待审核申请", value: stats.pendingApps },
  ];

  return (
    <AdminLayout title="总览">
      {error && (
        <Card className="p-4 mb-3 border-destructive/40 bg-destructive/5 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-destructive font-medium">数据加载失败</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
          <Button size="sm" variant="outline" onClick={load}>重试</Button>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-3">
        {loading && !error
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-4"><Skeleton className="h-3 w-16 mb-2" /><Skeleton className="h-6 w-24" /></Card>
            ))
          : cards.map((c) => (
              <Card key={c.label} className="p-4">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-xl font-bold mt-1">{c.value}</p>
              </Card>
            ))}
      </div>
      <p className="text-xs text-muted-foreground mt-4">所有金额按 RPC 自动结算，订单完成时入账（commission_settings 即时生效），提现需双向确认。</p>
    </AdminLayout>
  );
};

export default AdminDashboardPage;
