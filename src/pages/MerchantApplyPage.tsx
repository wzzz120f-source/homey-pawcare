import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ImagePlus, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const schema = z.object({
  store_name: z.string().trim().min(2, "店铺名称至少 2 个字").max(60),
  description: z.string().trim().max(500).optional(),
  contact_name: z.string().trim().max(40).optional(),
  contact_phone: z
    .string()
    .trim()
    .regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
  address: z.string().trim().max(120).optional(),
  license_number: z.string().trim().min(6, "请填写营业执照编号").max(60),
});

type Application = {
  id: string;
  store_name: string;
  status: string;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  created_merchant_id: string | null;
};

const statusBadge: Record<string, { label: string; cls: string }> = {
  pending: { label: "审核中", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  approved: { label: "已通过", cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  rejected: { label: "未通过", cls: "bg-destructive/10 text-destructive" },
};

const MerchantApplyPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [form, setForm] = useState({
    store_name: "",
    description: "",
    contact_name: "",
    contact_phone: "",
    address: "",
    license_number: "",
  });
  const [licenseUrl, setLicenseUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<Application[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const loadHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("merchant_applications")
      .select("id,store_name,status,review_note,created_at,reviewed_at,created_merchant_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("加载历史失败：" + error.message);
    else setHistory((data || []) as Application[]);
    setLoadingHistory(false);
  };

  useEffect(() => {
    if (user) loadHistory();
  }, [user]);

  const hasPending = history.some((h) => h.status === "pending");

  const handleUploadLicense = async (file: File) => {
    if (!user) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("文件超过 8MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/license-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      contentType: file.type || undefined,
    });
    if (error) {
      toast.error("上传失败：" + error.message);
    } else {
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setLicenseUrl(data.publicUrl);
      toast.success("营业执照已上传");
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("merchant_applications").insert({
      user_id: user.id,
      store_name: parsed.data.store_name,
      description: parsed.data.description || null,
      contact_name: parsed.data.contact_name || null,
      contact_phone: parsed.data.contact_phone,
      address: parsed.data.address || null,
      license_number: parsed.data.license_number,
      license_image_url: licenseUrl || null,
    });
    if (error) {
      toast.error("提交失败：" + error.message);
    } else {
      toast.success("申请已提交，请等待平台审核");
      setForm({
        store_name: "",
        description: "",
        contact_name: "",
        contact_phone: "",
        address: "",
        license_number: "",
      });
      setLicenseUrl("");
      loadHistory();
    }
    setSubmitting(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-nav">
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="flex items-center gap-2 px-4 h-14 max-w-lg mx-auto">
          <Button size="icon" variant="ghost" onClick={() => navigate("/profile")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-extrabold text-lg">商家入驻申请</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-5">
        <div className="bg-gradient-to-br from-primary/10 to-secondary/30 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
            <Store className="w-5 h-5 text-primary" />
          </div>
          <div className="text-sm text-foreground/80 space-y-1">
            <p className="font-bold text-foreground">入驻萌宠到家</p>
            <p className="text-xs text-muted-foreground">
              提交营业执照与店铺信息，平台审核通过后将自动开通商家中心，您即可上架商品、管理订单。
            </p>
          </div>
        </div>

        {hasPending && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-200">
            您有正在审核中的申请，请耐心等待审核结果，无需重复提交。
          </div>
        )}

        <section className="bg-card rounded-2xl p-4 card-shadow space-y-3">
          <h2 className="font-bold text-foreground">店铺信息</h2>
          <div>
            <Label className="text-xs">店铺名称 *</Label>
            <Input value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} maxLength={60} placeholder="例：旺旺宠物食品旗舰店" />
          </div>
          <div>
            <Label className="text-xs">店铺简介</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} maxLength={500} placeholder="主营品类、品牌特色等" />
          </div>
          <div>
            <Label className="text-xs">联系人</Label>
            <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} maxLength={40} />
          </div>
          <div>
            <Label className="text-xs">联系电话 *</Label>
            <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} inputMode="tel" maxLength={11} placeholder="11 位手机号" />
          </div>
          <div>
            <Label className="text-xs">店铺地址</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={120} />
          </div>
        </section>

        <section className="bg-card rounded-2xl p-4 card-shadow space-y-3">
          <h2 className="font-bold text-foreground">资质证明</h2>
          <div>
            <Label className="text-xs">营业执照编号 *</Label>
            <Input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} maxLength={60} />
          </div>
          <div>
            <Label className="text-xs">营业执照照片</Label>
            <label className="mt-1 flex items-center gap-3 p-3 border border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/40 transition">
              <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                {licenseUrl ? (
                  <img src={licenseUrl} alt="营业执照" className="w-full h-full object-cover" />
                ) : uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <ImagePlus className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {licenseUrl ? "已上传，点击重新选择" : "上传营业执照照片（≤8MB）"}
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadLicense(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </section>

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting || hasPending}>
          {submitting ? "提交中..." : hasPending ? "已有待审核申请" : "提交申请"}
        </Button>

        <section className="space-y-2">
          <h2 className="font-bold text-foreground text-sm">我的申请记录</h2>
          {loadingHistory ? (
            <div className="py-6 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-primary" /></div>
          ) : history.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-6">暂无申请记录</div>
          ) : (
            <div className="space-y-2">
              {history.map((h) => {
                const sb = statusBadge[h.status] || { label: h.status, cls: "bg-muted" };
                return (
                  <div key={h.id} className="bg-card rounded-xl p-3 card-shadow text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold truncate">{h.store_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sb.cls}`}>{sb.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      提交于 {format(new Date(h.created_at), "yyyy-MM-dd HH:mm")}
                      {h.reviewed_at && <> · 审核于 {format(new Date(h.reviewed_at), "yyyy-MM-dd HH:mm")}</>}
                    </div>
                    {h.review_note && (
                      <p className="text-xs text-muted-foreground mt-1">备注：{h.review_note}</p>
                    )}
                    {h.status === "approved" && (
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate("/merchant")}>
                        进入商家中心
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <BottomNav />
    </div>
  );
};

export default MerchantApplyPage;
