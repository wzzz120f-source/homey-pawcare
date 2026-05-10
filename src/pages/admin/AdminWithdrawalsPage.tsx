import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABEL: Record<string, string> = { pending: "待审批", flagged: "已标红", paid: "已打款", rejected: "已驳回" };

const csvEscape = (v: any) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const AdminWithdrawalsPage = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState<"pending" | "flagged" | "history">("pending");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = async () => {
    setLoading(true); setError(null);
    let q = supabase.from("withdrawal_requests").select("*").order("requested_at", { ascending: false });
    if (tab === "pending") q = q.eq("status", "pending");
    else if (tab === "flagged") q = q.eq("status", "flagged");
    else q = q.in("status", ["paid", "rejected"]);
    if (from) q = q.gte("requested_at", new Date(from).toISOString());
    if (to) q = q.lte("requested_at", new Date(`${to}T23:59:59`).toISOString());
    const { data, error } = await q;
    if (error) setError(error.message);
    setRows((data as any[]) || []); setSelected(new Set());
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab, from, to]);

  const approve = async (id: string, force = false) => {
    const fn = force ? "admin_force_pay_withdrawal" : "admin_approve_withdrawal";
    const { data, error } = await supabase.rpc(fn as any, { _id: id });
    if (error || (data as any)?.success === false) {
      toast({ title: "操作失败", description: error?.message || (data as any)?.error, variant: "destructive" });
    } else {
      const flagged = (data as any)?.flagged;
      toast({ title: flagged ? "已标记风险，待复核" : "已打款", description: flagged ? `风险标签: ${(data as any).risk_flags?.join(",")}` : undefined });
      load();
    }
  };
  const batchApprove = async () => { for (const id of selected) await approve(id, false); };
  const submitReject = async () => {
    if (!rejectTarget) return;
    const { data, error } = await supabase.rpc("admin_reject_withdrawal" as any, { _id: rejectTarget, _reason: reason });
    if (error || (data as any)?.success === false) toast({ title: "驳回失败", variant: "destructive" });
    else { toast({ title: "已驳回" }); setRejectTarget(null); setReason(""); load(); }
  };

  const exportCsv = (scope: "selected" | "all") => {
    const items = scope === "selected" ? rows.filter((r) => selected.has(r.id)) : rows;
    if (items.length === 0) { toast({ title: "无数据可导出", variant: "destructive" }); return; }
    const header = ["申请ID", "用户ID", "角色", "状态", "金额", "手续费", "实发", "申请时间", "审核时间", "凭证号", "驳回原因", "风险标签", "银行信息"];
    const lines = items.map((r) => [
      r.id, r.user_id, r.role, STATUS_LABEL[r.status] || r.status,
      r.amount, r.fee, r.actual_amount,
      r.requested_at ? new Date(r.requested_at).toLocaleString() : "",
      r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : "",
      r.voucher_no || "", r.reject_reason || "",
      (r.risk_flags || []).join("|"),
      JSON.stringify(r.bank_info || {}),
    ].map(csvEscape).join(","));
    const csv = "\uFEFF" + [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `withdrawals-${tab}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout title="提现审批">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="pending">待审批</TabsTrigger>
          <TabsTrigger value="flagged">已标红</TabsTrigger>
          <TabsTrigger value="history">历史</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="起" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="止" />
          </div>
          <div className="flex flex-wrap gap-2">
            {tab === "pending" && selected.size > 0 && (
              <Button size="sm" onClick={batchApprove}>批量打款 ({selected.size})</Button>
            )}
            {selected.size > 0 && (
              <Button size="sm" variant="outline" onClick={() => exportCsv("selected")}>
                <Download className="w-4 h-4 mr-1" />导出选中 ({selected.size})
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => exportCsv("all")}>
              <Download className="w-4 h-4 mr-1" />导出全部对账 ({rows.length})
            </Button>
          </div>
          {error && (
            <Card className="p-4 border-destructive/40 bg-destructive/5 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
              <div className="flex-1"><p className="text-sm text-destructive">{error}</p></div>
              <Button size="sm" variant="outline" onClick={load}>重试</Button>
            </Card>
          )}
          {loading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
            : rows.length === 0 && !error ? <p className="text-center text-muted-foreground py-8">暂无</p>
            : rows.map((r) => (
              <Card key={r.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <Checkbox checked={selected.has(r.id)} onCheckedChange={(c) => {
                      const ns = new Set(selected); if (c) ns.add(r.id); else ns.delete(r.id); setSelected(ns);
                    }} />
                    <div>
                      <p className="font-semibold">¥{Number(r.amount).toFixed(2)} <span className="text-xs text-muted-foreground font-normal">(到账 ¥{Number(r.actual_amount).toFixed(2)} / 手续费 ¥{Number(r.fee).toFixed(2)})</span></p>
                      <p className="text-xs text-muted-foreground">{r.role} · {new Date(r.requested_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <Badge variant={r.status === "flagged" ? "destructive" : "secondary"}>{STATUS_LABEL[r.status]}</Badge>
                </div>
                {r.risk_flags?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {r.risk_flags.map((f: string) => <Badge key={f} variant="destructive" className="text-[10px]">{f}</Badge>)}
                  </div>
                )}
                {r.voucher_no && <p className="text-xs text-muted-foreground">凭证 {r.voucher_no}</p>}
                {r.reject_reason && <p className="text-xs text-destructive">驳回理由：{r.reject_reason}</p>}
                {(tab === "pending" || tab === "flagged") && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => approve(r.id, tab === "flagged")}>{tab === "flagged" ? "确认强制打款" : "审批通过"}</Button>
                    <Button size="sm" variant="outline" onClick={() => { setRejectTarget(r.id); setReason(""); }}>驳回</Button>
                  </div>
                )}
              </Card>
            ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>驳回理由</DialogTitle></DialogHeader>
          <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="冻结金额将退回可用余额" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>取消</Button>
            <Button onClick={submitReject} disabled={!reason.trim()}>确认驳回</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminWithdrawalsPage;
