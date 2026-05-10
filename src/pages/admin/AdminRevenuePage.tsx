import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ROLE_LABEL: Record<string, string> = {
  driver: "司机", sitter: "宠托师", groomer: "护理师", merchant: "商家",
};

const AdminRevenuePage = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase
      .from("earning_transactions")
      .select("role,gross,commission,net,settled_at")
      .order("settled_at", { ascending: false }).limit(200);
    if (error) { setError(error.message); setLoading(false); return; }
    setRows((data as any[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

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
  const totalGross = Object.values(grouped).reduce((s, x) => s + x.gross, 0);

  return (
    <AdminLayout title="收益看板">
      {error && (
        <Card className="p-4 mb-3 border-destructive/40 bg-destructive/5 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
          <div className="flex-1"><p className="text-sm text-destructive">{error}</p></div>
          <Button size="sm" variant="outline" onClick={load}>重试</Button>
        </Card>
      )}
      {loading ? (
        <Card className="p-4 mb-4"><Skeleton className="h-4 w-32 mb-2" /><Skeleton className="h-8 w-40" /></Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">累计佣金（最近 200 条）</p>
            <p className="text-2xl font-bold">{fmt(totalCommission)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">对应平台流水</p>
            <p className="text-2xl font-bold">{fmt(totalGross)}</p>
          </Card>
        </div>
      )}
      <h3 className="text-sm font-semibold mb-2">各角色贡献</h3>
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (
        <div className="space-y-2">
          {Object.entries(grouped).map(([role, v]) => (
            <Card key={role} className="p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{ROLE_LABEL[role] || role}</p>
                <p className="text-sm">{v.count} 笔 · 佣金 <span className="font-semibold">{fmt(v.commission)}</span></p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">流水 {fmt(v.gross)} · 净结算 {fmt(v.net)}</p>
            </Card>
          ))}
          {Object.keys(grouped).length === 0 && <p className="text-center text-muted-foreground py-8">暂无结算流水</p>}
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminRevenuePage;
