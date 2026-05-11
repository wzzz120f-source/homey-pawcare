import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Kind = "driver" | "merchant" | "rescue" | "kyc";
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
    if (tab === "rescue") {
      const { data, error } = await supabase
        .from("rescue_stories" as any)
        .select("*")
        .eq("verify_status", "pending")
        .order("created_at", { ascending: false });
      if (error) setError(error.message);
      setList((data as any[]) || []);
    } else if (tab === "kyc") {
      const { data, error } = await supabase
        .from("rescue_kyc" as any)
        .select("*")
        .eq("status", "pending")
        .order("submitted_at", { ascending: false });
      if (error) setError(error.message);
      setList((data as any[]) || []);
    } else {
      const table = tab === "driver" ? "driver_applications" : "merchant_applications";
      const { data, error } = await supabase.from(table as any).select("*").eq("status", "pending").order("created_at", { ascending: false });
      if (error) setError(error.message);
      setList((data as any[]) || []);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const approve = async (id: string) => {
    let fn: string; let args: any;
    if (tab === "rescue") { fn = "admin_review_rescue_story"; args = { _id: id, _approve: true, _note: null }; }
    else if (tab === "kyc") { fn = "admin_review_rescue_kyc"; args = { _uid: id, _approve: true, _note: null }; }
    else { fn = tab === "driver" ? "approve_driver_application" : "approve_merchant_application"; args = { _application_id: id }; }
    const { data, error } = await supabase.rpc(fn as any, args);
    if (error || (data as any)?.success === false) {
      toast({ title: "审批失败", description: error?.message || (data as any)?.error, variant: "destructive" });
    } else {
      toast({ title: "已通过" }); load();
    }
  };
  const submitReject = async () => {
    if (!rejectTarget) return;
    let fn: string; let args: any;
    if (rejectTarget.kind === "rescue") { fn = "admin_review_rescue_story"; args = { _id: rejectTarget.id, _approve: false, _note: reason }; }
    else if (rejectTarget.kind === "kyc") { fn = "admin_review_rescue_kyc"; args = { _uid: rejectTarget.id, _approve: false, _note: reason }; }
    else if (rejectTarget.kind === "driver") { fn = "reject_driver_application"; args = { _application_id: rejectTarget.id, _reason: reason }; }
    else { fn = "reject_merchant_application"; args = { _application_id: rejectTarget.id, _note: reason }; }
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
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="driver">司机/宠托</TabsTrigger>
          <TabsTrigger value="merchant">商家</TabsTrigger>
          <TabsTrigger value="rescue">救助审核</TabsTrigger>
          <TabsTrigger value="kyc">提现实名</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="space-y-3 mt-3">
          {error && (
            <Card className="p-4 border-destructive/40 bg-destructive/5 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
              <div className="flex-1"><p className="text-sm text-destructive">{error}</p></div>
              <Button size="sm" variant="outline" onClick={load}>重试</Button>
            </Card>
          )}
          {loading ? <p className="text-center text-muted-foreground py-8">加载中…</p>
            : list.length === 0 && !error ? <p className="text-center text-muted-foreground py-8">暂无待审核</p>
            : list.map((a) => (
              <Card key={a.id || a.user_id} className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">
                      {tab === "rescue"
                        ? `${a.pet_type === "cat" ? "🐱" : a.pet_type === "dog" ? "🐶" : "🐾"} ${a.pet_name}`
                        : tab === "kyc" ? a.real_name
                        : (a.full_name || a.contact_name || a.store_name || "—")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tab === "rescue" ? `实名：${a.real_name || "—"} · 末4位：${a.id_card_last4 || "—"} · ${a.location || ""}`
                        : tab === "kyc" ? `证件末4位：${a.id_card_last4 || "—"} · ${a.bank_name} · ${a.bank_account_no?.slice(-4)}`
                        : (a.phone || a.contact_phone)}
                    </p>
                  </div>
                  {tab === "driver" ? <Badge>{ROLE_LABEL[a.role_requested] || a.role_requested}</Badge>
                    : tab === "merchant" ? <Badge>商家</Badge>
                    : tab === "kyc" ? <Badge>实名</Badge>
                    : <Badge>救助</Badge>}
                </div>
                {tab === "driver" && (
                  <p className="text-xs text-muted-foreground">驾龄 {a.driving_years} 年 · {a.vehicle_type} · 性别 {a.gender}</p>
                )}
                {tab === "merchant" && a.address && <p className="text-xs text-muted-foreground">{a.address}</p>}
                {tab === "rescue" && (
                  <>
                    <p className="text-xs text-foreground line-clamp-3">{a.story}</p>
                    {a.proof_urls?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {a.proof_urls.map((u: string, i: number) => (
                          <a key={i} href={u} target="_blank" rel="noreferrer">
                            <img src={u} className="w-16 h-16 object-cover rounded border border-border" />
                          </a>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {tab === "kyc" && (
                  <div className="flex flex-wrap gap-1.5">
                    {[a.id_card_front_url, a.id_card_back_url, a.hold_id_url].filter(Boolean).map((path: string, i: number) => (
                      <KycThumb key={i} path={path} />
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => approve(tab === "kyc" ? a.user_id : a.id)}>通过</Button>
                  <Button size="sm" variant="outline" onClick={() => { setRejectTarget({ id: tab === "kyc" ? a.user_id : a.id, kind: tab }); setReason(""); }}>驳回</Button>
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
