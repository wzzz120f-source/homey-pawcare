import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABEL: Record<string, string> = { pending: "待审批", flagged: "已标红", paid: "已打款", rejected: "已驳回" };

const AdminWithdrawalsPage = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState<"pending" | "flagged" | "history">("pending");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true); setError(null);
    let q = supabase.from("withdrawal_requests").select("*").order("requested_at", { ascending: false });
    if (tab === "pending") q = q.eq("status", "pending");
    else if (tab === "flagged") q = q.eq("status", "flagged");
    else q = q.in("status", ["paid", "rejected"]);
    const { data, error } = await q;
    if (error) setError(error.message);
    setRows((data as any[]) || []); setSelected(new Set());
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

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
  const batchApprove = async () => {
    for (const id of selected) await approve(id, false);
  };
  const submitReject = async () => {
    if (!rejectTarget) return;
    const { data, error } = await supabase.rpc("admin_reject_withdrawal" as any, { _id: rejectTarget, _reason: reason });
    if (error || (data as any)?.success === false) toast({ title: "驳回失败", variant: "destructive" });
    else { toast({ title: "已驳回" }); setRejectTarget(null); setReason(""); load(); }
  };
  const exportCsv = () => {
    const items = rows.filter((r) => selected.has(r.id));
    const csv = ["id,user_id,amount,fee,actual,bank_info", ...items.map((r) => `${r.id},${r.user_id},${r.amount},${r.fee},${r.actual_amount},"${JSON.stringify(r.bank_info).replace(/"/g, "\"\"")}"`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `withdrawals-${Date.now()}.csv`; a.click();
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
          {tab === "pending" && selected.size > 0 && (
            <div className="flex gap-2">
              <Button size="sm" onClick={batchApprove}>批量打款 ({selected.size})</Button>
              <Button size="sm" variant="outline" onClick={exportCsv}>导出银行报表</Button>
            </div>
          )}
          {rows.length === 0 ? <p className="text-center text-muted-foreground py-8">暂无</p>
            : rows.map((r) => (
              <Card key={r.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    {tab === "pending" && (
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={(c) => {
                        const ns = new Set(selected); if (c) ns.add(r.id); else ns.delete(r.id); setSelected(ns);
                      }} />
                    )}
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
