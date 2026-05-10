import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Row = { role: string; mode: "percent" | "fixed"; value: number };
const ROLES: { key: string; label: string }[] = [
  { key: "driver", label: "司机" }, { key: "sitter", label: "宠托师" },
  { key: "groomer", label: "护理师" }, { key: "merchant", label: "商家" },
];

const AdminCommissionPage = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.from("commission_settings").select("role,mode,value");
    if (error) { setError(error.message); setLoading(false); return; }
    const m: Record<string, Row> = {};
    (data || []).forEach((r: any) => { m[r.role] = { role: r.role, mode: r.mode, value: Number(r.value) }; });
    ROLES.forEach((r) => { if (!m[r.key]) m[r.key] = { role: r.key, mode: "percent", value: 0 }; });
    setRows(m); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async (role: string) => {
    const r = rows[role];
    setSavingKey(role);
    const { data, error } = await supabase.rpc("admin_set_commission" as any, { _role: role, _mode: r.mode, _value: r.value });
    setSavingKey(null);
    if (error || (data as any)?.success === false) {
      toast({ title: "保存失败", description: error?.message || (data as any)?.error, variant: "destructive" });
    } else toast({ title: "已保存" });
  };

  return (
    <AdminLayout title="抽成配置">
      <p className="text-xs text-muted-foreground mb-3">修改即时对新订单生效，已结订单不追溯。未配置的角色佣金按 0 计（净收入全归服务者）。</p>
      {error && (
        <Card className="p-4 mb-3 border-destructive/40 bg-destructive/5 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
          <div className="flex-1"><p className="text-sm text-destructive">{error}</p></div>
          <Button size="sm" variant="outline" onClick={load}>重试</Button>
        </Card>
      )}
      <div className="space-y-3">
        {loading
          ? ROLES.map((r) => <Card key={r.key} className="p-4"><Skeleton className="h-10 w-full" /></Card>)
          : ROLES.map(({ key, label }) => {
              const r = rows[key]; if (!r) return null;
              return (
                <Card key={key} className="p-4 grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3"><p className="text-sm font-medium">{label}</p></div>
                  <div className="col-span-3">
                    <select className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                      value={r.mode} onChange={(e) => setRows((p) => ({ ...p, [key]: { ...r, mode: e.target.value as any } }))}>
                      <option value="percent">百分比 %</option>
                      <option value="fixed">固定金额 ¥</option>
                    </select>
                  </div>
                  <div className="col-span-3">
                    <Input type="number" step="0.01" value={r.value}
                      onChange={(e) => setRows((p) => ({ ...p, [key]: { ...r, value: Number(e.target.value) } }))} />
                  </div>
                  <div className="col-span-3">
                    <Button size="sm" className="w-full" disabled={savingKey === key} onClick={() => save(key)}>
                      {savingKey === key ? "保存中…" : "保存"}
                    </Button>
                  </div>
                </Card>
              );
            })}
      </div>
    </AdminLayout>
  );
};

export default AdminCommissionPage;
