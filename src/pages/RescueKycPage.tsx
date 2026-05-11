import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Loader2, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Status = "none" | "pending" | "approved" | "rejected";

const STATUS_LABEL: Record<Status, string> = {
  none: "未提交", pending: "审核中", approved: "已通过", rejected: "已驳回",
};

const RescueKycPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<Status>("none");
  const [reviewNote, setReviewNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [realName, setRealName] = useState("");
  const [idCard, setIdCard] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [frontUrl, setFrontUrl] = useState("");
  const [backUrl, setBackUrl] = useState("");
  const [holdUrl, setHoldUrl] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    void load();
  }, [user, authLoading]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("rescue_kyc" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      const k = data as any;
      setStatus((k.status as Status) || "pending");
      setReviewNote(k.review_note || null);
      setRealName(k.real_name || "");
      setBankName(k.bank_name || "");
      setBankAccountName(k.bank_account_name || "");
      setBankAccountNo(k.bank_account_no || "");
    }
    setLoading(false);
  };

  const upload = async (file: File, kind: "front" | "back" | "hold"): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("kyc-documents").upload(path, file, { upsert: true });
    if (error) { toast.error("上传失败：" + error.message); return null; }
    return path;
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>, kind: "front" | "back" | "hold") => {
    const file = e.target.files?.[0]; if (!file) return;
    const path = await upload(file, kind);
    if (!path) return;
    if (kind === "front") setFrontUrl(path);
    if (kind === "back") setBackUrl(path);
    if (kind === "hold") setHoldUrl(path);
    toast.success("已上传");
  };

  const submit = async () => {
    if (!realName || realName.length < 2) return toast.error("请输入真实姓名");
    if (!idCard || idCard.length < 8) return toast.error("请输入有效身份证号");
    if (!frontUrl || !backUrl || !holdUrl) return toast.error("请上传完整证件照");
    if (!bankAccountNo || !bankName || !bankAccountName) return toast.error("请填写银行卡信息");
    if (bankAccountName !== realName) return toast.error("银行卡户名必须与实名一致");

    setSubmitting(true);
    const { data, error } = await supabase.rpc("submit_rescue_kyc" as any, {
      _real_name: realName, _id_card_no: idCard,
      _front_url: frontUrl, _back_url: backUrl, _hold_url: holdUrl,
      _bank_account_name: bankAccountName, _bank_account_no: bankAccountNo, _bank_name: bankName,
    });
    setSubmitting(false);
    if (error || (data as any)?.success === false) {
      toast.error((error?.message) || (data as any)?.error || "提交失败");
    } else {
      toast.success("已提交，审核结果将在 1~3 天通知");
      setStatus("pending");
      setReviewNote(null);
    }
  };

  const editable = status === "none" || status === "rejected";

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate(-1)} aria-label="返回" className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-lg font-bold flex-1">救助提现实名认证</h1>
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">当前状态</span>
            <Badge variant={status === "approved" ? "secondary" : status === "rejected" ? "destructive" : "outline"}>
              {STATUS_LABEL[status]}
            </Badge>
          </div>
          {status === "rejected" && reviewNote && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 rounded-lg p-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{reviewNote}</span>
            </div>
          )}
          {status === "approved" && (
            <p className="text-sm text-emerald-600 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />可申请提现救助资金</p>
          )}
          <p className="text-xs text-muted-foreground">为防止虚假救助与洗钱，收到爱心投喂的资金需通过实名认证后方可提现。证件信息仅用于审核，严格保密。</p>
        </Card>

        {loading ? <p className="text-center text-muted-foreground py-8">加载中…</p> : (
          <Card className="p-4 space-y-3">
            <div><Label>真实姓名 *</Label>
              <Input value={realName} onChange={(e) => setRealName(e.target.value)} disabled={!editable} placeholder="与身份证一致" /></div>
            <div><Label>身份证号 *</Label>
              <Input value={idCard} onChange={(e) => setIdCard(e.target.value)} disabled={!editable} placeholder="18 位证件号" maxLength={18} /></div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { k: "front", url: frontUrl, label: "证件正面" },
                { k: "back", url: backUrl, label: "证件背面" },
                { k: "hold", url: holdUrl, label: "手持证件" },
              ].map((it) => (
                <label key={it.k} className="aspect-square border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-xs text-muted-foreground cursor-pointer overflow-hidden">
                  {it.url ? (
                    <span className="text-emerald-600 text-center p-1"><CheckCircle2 className="w-5 h-5 mx-auto mb-1" />{it.label}</span>
                  ) : (
                    <><Upload className="w-4 h-4 mb-1" />{it.label}</>
                  )}
                  <input type="file" accept="image/*" hidden disabled={!editable}
                    onChange={(e) => onFile(e, it.k as any)} />
                </label>
              ))}
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-sm font-semibold">收款银行卡（户名必须与实名一致）</p>
              <div><Label>开户银行 *</Label>
                <Input value={bankName} onChange={(e) => setBankName(e.target.value)} disabled={!editable} placeholder="工商银行" /></div>
              <div><Label>持卡人姓名 *</Label>
                <Input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} disabled={!editable} placeholder="必须与实名一致" /></div>
              <div><Label>银行卡号 *</Label>
                <Input value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} disabled={!editable} placeholder="6222 ****" /></div>
            </div>

            {editable && (
              <Button className="w-full" onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {status === "rejected" ? "重新提交审核" : "提交审核"}
              </Button>
            )}
          </Card>
        )}
      </main>
    </div>
  );
};

export default RescueKycPage;
