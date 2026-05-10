import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const AdminRevenuePage = () => {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("earning_transactions").select("role,gross,commission,net,settled_at").order("settled_at", { ascending: false }).limit(200);
      setRows((data as any[]) || []);
    })();
  }, []);

  const grouped = useMemo(() => {
    const m: Record<string, { gross: number; commission: number; net: number; count: number }> = {};
    rows.forEach((r) => {
      const k = r.role || "unknown";
      m[k] ||= { gross: 0, commission: 0, net: 0, count: 0 };
      m[k].gross += Number(r.gross); m[k].commission += Number(r.commission);
      m[k].net += Number(r.net); m[k].count += 1;
    });
    return m;
  }, [rows]);

  const fmt = (n: number) => `¥${n.toFixed(2)}`;
  const totalCommission = Object.values(grouped).reduce((s, x) => s + x.commission, 0);

  return (
    <AdminLayout title="收益看板">
      <Card className="p-4 mb-4">
        <p className="text-xs text-muted-foreground">累计平台佣金（最近 200 条）</p>
        <p className="text-2xl font-bold">{fmt(totalCommission)}</p>
      </Card>
      <h3 className="text-sm font-semibold mb-2">各角色贡献</h3>
      <div className="space-y-2">
        {Object.entries(grouped).map(([role, v]) => (
          <Card key={role} className="p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">{role}</p>
              <p className="text-sm">{v.count} 笔 · 佣金 <span className="font-semibold">{fmt(v.commission)}</span></p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">流水 {fmt(v.gross)} · 净结算 {fmt(v.net)}</p>
          </Card>
        ))}
        {Object.keys(grouped).length === 0 && <p className="text-center text-muted-foreground py-8">暂无结算流水</p>}
      </div>
    </AdminLayout>
  );
};

export default AdminRevenuePage;
