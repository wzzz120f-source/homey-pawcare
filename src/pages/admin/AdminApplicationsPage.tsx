import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Kind = "driver" | "merchant";
const ROLE_LABEL: Record<string, string> = { sitter: "宠托师", groomer: "护理师", driver: "司机" };

const AdminApplicationsPage = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState<Kind>("driver");
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; kind: Kind } | null>(null);
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true); setError(null);
    const table = tab === "driver" ? "driver_applications" : "merchant_applications";
    const { data, error } = await supabase.from(table as any).select("*").eq("status", "pending").order("created_at", { ascending: false });
    if (error) setError(error.message);
    setList((data as any[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const approve = async (id: string) => {
    const fn = tab === "driver" ? "approve_driver_application" : "approve_merchant_application";
    const { data, error } = await supabase.rpc(fn as any, { _application_id: id });
    if (error || (data as any)?.success === false) {
      toast({ title: "审批失败", description: error?.message || (data as any)?.error, variant: "destructive" });
    } else {
      toast({ title: "已通过" }); load();
    }
  };
  const submitReject = async () => {
    if (!rejectTarget) return;
    const fn = rejectTarget.kind === "driver" ? "reject_driver_application" : "reject_merchant_application";
    const args: any = rejectTarget.kind === "driver"
      ? { _application_id: rejectTarget.id, _reason: reason }
      : { _application_id: rejectTarget.id, _note: reason };
    const { data, error } = await supabase.rpc(fn as any, args);
    if (error || (data as any)?.success === false) {
      toast({ title: "驳回失败", description: error?.message || (data as any)?.error, variant: "destructive" });
    } else {
      toast({ title: "已驳回" }); setRejectTarget(null); setReason(""); load();
    }
  };

  return (
    <AdminLayout title="注册审核">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Kind)}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="driver">司机/宠托/护理</TabsTrigger>
          <TabsTrigger value="merchant">商家</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="space-y-3 mt-3">
          {loading ? <p className="text-center text-muted-foreground py-8">加载中…</p>
            : list.length === 0 ? <p className="text-center text-muted-foreground py-8">暂无待审核</p>
            : list.map((a) => (
              <Card key={a.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{a.full_name || a.contact_name || a.store_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{a.phone || a.contact_phone}</p>
                  </div>
                  {tab === "driver"
                    ? <Badge>{ROLE_LABEL[a.role_requested] || a.role_requested}</Badge>
                    : <Badge>商家</Badge>}
                </div>
                {tab === "driver" && (
                  <p className="text-xs text-muted-foreground">驾龄 {a.driving_years} 年 · {a.vehicle_type} · 性别 {a.gender}</p>
                )}
                {tab === "merchant" && a.address && <p className="text-xs text-muted-foreground">{a.address}</p>}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => approve(a.id)}>通过</Button>
                  <Button size="sm" variant="outline" onClick={() => { setRejectTarget({ id: a.id, kind: tab }); setReason(""); }}>驳回</Button>
                </div>
              </Card>
            ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>驳回理由</DialogTitle></DialogHeader>
          <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="请填写理由，将通知申请人" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>取消</Button>
            <Button onClick={submitReject} disabled={!reason.trim()}>确认驳回</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminApplicationsPage;
