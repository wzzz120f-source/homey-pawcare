import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ACTION_LABEL: Record<string, string> = {
  withdrawal_approved: "提现-通过",
  withdrawal_flagged: "提现-标红",
  withdrawal_force_paid: "提现-强制打款",
  withdrawal_rejected: "提现-驳回",
  commission_updated: "抽成-更新",
  driver_application_approved: "司机-通过",
  driver_application_rejected: "司机-驳回",
  merchant_application_approved: "商家-通过",
  merchant_application_rejected: "商家-驳回",
};

const PAGE_SIZE = 30;

const AdminAuditLogPage = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const load = async (reset = false) => {
    setLoading(true); setError(null);
    const _page = reset ? 0 : page;
    let q = supabase.from("admin_audit_logs" as any).select("*")
      .order("created_at", { ascending: false })
      .range(_page * PAGE_SIZE, _page * PAGE_SIZE + PAGE_SIZE - 1);
    if (actionFilter !== "all") q = q.eq("action", actionFilter);
    if (from) q = q.gte("created_at", new Date(from).toISOString());
    if (to) q = q.lte("created_at", new Date(`${to}T23:59:59`).toISOString());
    const { data, error } = await q;
    if (error) { setError(error.message); setLoading(false); return; }
    const list = (data as any[]) || [];
    setRows(reset ? list : [...rows, ...list]);
    setHasMore(list.length === PAGE_SIZE);
    if (reset) setPage(1); else setPage(_page + 1);
    setLoading(false);
  };
  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [actionFilter, from, to]);

  return (
    <AdminLayout title="操作审计">
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger><SelectValue placeholder="动作类型" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部动作</SelectItem>
            {Object.entries(ACTION_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <div />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="起" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="止" />
      </div>

      {error && (
        <Card className="p-4 mb-3 border-destructive/40 bg-destructive/5 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
          <div className="flex-1"><p className="text-sm text-destructive">{error}</p></div>
          <Button size="sm" variant="outline" onClick={() => load(true)}>重试</Button>
        </Card>
      )}

      <div className="space-y-2">
        {loading && rows.length === 0
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          : rows.length === 0 && !error
          ? <p className="text-center text-muted-foreground py-8">暂无操作记录</p>
          : rows.map((r) => (
              <Card key={r.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge>{ACTION_LABEL[r.action] || r.action}</Badge>
                      <span className="text-xs text-muted-foreground">{r.target_type} · {r.target_id?.slice(0, 8)}</span>
                    </div>
                    <pre className="text-[11px] mt-1 text-muted-foreground whitespace-pre-wrap break-all">
                      {JSON.stringify(r.details, null, 0)}
                    </pre>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">操作员 {r.admin_id?.slice(0, 8)}</p>
              </Card>
            ))}
      </div>

      {hasMore && rows.length > 0 && (
        <div className="text-center mt-4">
          <Button variant="outline" disabled={loading} onClick={() => load(false)}>{loading ? "加载中..." : "加载更多"}</Button>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminAuditLogPage;
