import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

const AdminDashboardPage = () => {
  const [stats, setStats] = useState({ totalRevenue: 0, totalCommission: 0, pendingWithdraw: 0, frozen: 0, pendingApps: 0 });

  useEffect(() => {
    (async () => {
      const [{ data: earn }, { data: bal }, { data: wPending }, { data: drv }, { data: mer }] = await Promise.all([
        supabase.from("earning_transactions").select("gross,commission"),
        supabase.from("provider_balances").select("frozen"),
        supabase.from("withdrawal_requests").select("amount").eq("status", "pending"),
        supabase.from("driver_applications").select("id").eq("status", "pending"),
        supabase.from("merchant_applications").select("id").eq("status", "pending"),
      ]);
      setStats({
        totalRevenue: (earn || []).reduce((s, r: any) => s + Number(r.gross || 0), 0),
        totalCommission: (earn || []).reduce((s, r: any) => s + Number(r.commission || 0), 0),
        pendingWithdraw: (wPending || []).reduce((s, r: any) => s + Number(r.amount || 0), 0),
        frozen: (bal || []).reduce((s, r: any) => s + Number(r.frozen || 0), 0),
        pendingApps: (drv?.length || 0) + (mer?.length || 0),
      });
    })();
  }, []);

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
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-xl font-bold mt-1">{c.value}</p>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-4">所有金额按 RPC 自动结算，订单完成时入账，提现需双向确认。</p>
    </AdminLayout>
  );
};

export default AdminDashboardPage;
