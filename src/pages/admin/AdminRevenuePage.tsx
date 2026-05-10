import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ROLE_LABEL: Record<string, string> = {
  driver: "司机", sitter: "宠托师", groomer: "护理师", merchant: "商家",
};
const PAGE_SIZE = 50;

const AdminRevenuePage = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const load = async (reset = false) => {
    setLoading(true); setError(null);
    const _page = reset ? 0 : page;
    let q = supabase.from("earning_transactions")
      .select("role,gross,commission,net,settled_at")
      .order("settled_at", { ascending: false })
      .range(_page * PAGE_SIZE, _page * PAGE_SIZE + PAGE_SIZE - 1);
    if (role !== "all") q = q.eq("role", role as any);
    if (from) q = q.gte("settled_at", new Date(from).toISOString());
    if (to) q = q.lte("settled_at", new Date(`${to}T23:59:59`).toISOString());
    const { data, error } = await q;
    if (error) { setError(error.message); setLoading(false); return; }
    const list = (data as any[]) || [];
    setRows(reset ? list : [...rows, ...list]);
    setHasMore(list.length === PAGE_SIZE);
    if (reset) setPage(1); else setPage(_page + 1);
    setLoading(false);
  };
  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [role, from, to]);

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
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger><SelectValue placeholder="角色" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部角色</SelectItem>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <div />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {error && (
        <Card className="p-4 mb-3 border-destructive/40 bg-destructive/5 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
          <div className="flex-1"><p className="text-sm text-destructive">{error}</p></div>
          <Button size="sm" variant="outline" onClick={() => load(true)}>重试</Button>
        </Card>
      )}

      {loading && rows.length === 0 ? (
        <Card className="p-4 mb-4"><Skeleton className="h-4 w-32 mb-2" /><Skeleton className="h-8 w-40" /></Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">累计佣金（已加载 {rows.length} 条）</p>
            <p className="text-2xl font-bold">{fmt(totalCommission)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">对应平台流水</p>
            <p className="text-2xl font-bold">{fmt(totalGross)}</p>
          </Card>
        </div>
      )}

      <h3 className="text-sm font-semibold mb-2">各角色贡献</h3>
      {loading && rows.length === 0 ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (
        <div className="space-y-2">
          {Object.entries(grouped).map(([r, v]) => (
            <Card key={r} className="p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{ROLE_LABEL[r] || r}</p>
                <p className="text-sm">{v.count} 笔 · 佣金 <span className="font-semibold">{fmt(v.commission)}</span></p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">流水 {fmt(v.gross)} · 净结算 {fmt(v.net)}</p>
            </Card>
          ))}
          {Object.keys(grouped).length === 0 && <p className="text-center text-muted-foreground py-8">暂无结算流水</p>}
        </div>
      )}

      {hasMore && rows.length > 0 && (
        <div className="text-center mt-4">
          <Button variant="outline" disabled={loading} onClick={() => load(false)}>{loading ? "加载中..." : "加载更多"}</Button>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminRevenuePage;
