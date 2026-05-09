import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, IdCard, Loader2, ShieldCheck, Upload, FileText, Car } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type ApplicationStatus = "pending" | "approved" | "rejected";
export type ApplyRole = "sitter" | "groomer" | "driver";

export type DocKey =
  | "id_card_front_url"
  | "id_card_back_url"
  | "handheld_id_url"
  | "driver_license_url"
  | "vehicle_license_url";

export const DOC_DEFAULTS: Record<DocKey, { label: string; icon: LucideIcon }> = {
  id_card_front_url: { label: "身份证 · 人像面", icon: IdCard },
  id_card_back_url:  { label: "身份证 · 国徽面", icon: IdCard },
  handheld_id_url:   { label: "手持身份证照片", icon: ShieldCheck },
  driver_license_url:{ label: "驾驶证", icon: FileText },
  vehicle_license_url:{ label: "行驶证", icon: Car },
};

export interface LatestApplication {
  id: string;
  status: ApplicationStatus;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  role_requested: string | null;
  paths: Partial<Record<DocKey, string>>;
}

/** 拉取当前用户最近一条对应角色的申请 + 签名 URL */
export const useLatestApplication = (role: ApplyRole) => {
  const { user } = useAuth();
  const [data, setData] = useState<LatestApplication | null>(null);
  const [previews, setPreviews] = useState<Partial<Record<DocKey, string>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data: row } = await supabase
        .from("driver_applications")
        .select("id,status,review_note,created_at,reviewed_at,role_requested,id_card_front_url,id_card_back_url,driver_license_url,vehicle_license_url,handheld_id_url")
        .eq("user_id", user.id)
        .eq("role_requested", role)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !row) {
        setLoading(false);
        return;
      }
      const keys: DocKey[] = ["id_card_front_url","id_card_back_url","handheld_id_url","driver_license_url","vehicle_license_url"];
      const paths: Partial<Record<DocKey, string>> = {};
      const prevs: Partial<Record<DocKey, string>> = {};
      for (const k of keys) {
        const p = (row as Record<string, unknown>)[k] as string | null;
        if (p) {
          paths[k] = p;
          const { data: signed } = await supabase.storage.from("driver-documents").createSignedUrl(p, 3600);
          if (signed?.signedUrl) prevs[k] = signed.signedUrl;
        }
      }
      if (cancelled) return;
      setData({
        id: row.id,
        status: row.status as ApplicationStatus,
        review_note: row.review_note,
        created_at: row.created_at,
        reviewed_at: row.reviewed_at,
        role_requested: row.role_requested,
        paths,
      });
      setPreviews(prevs);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [user, role]);

  return { latestApp: data, initialPreviews: previews, loadingApp: loading };
};

/** 单个证件上传卡片 */
export const DocUploader = ({
  docKey,
  label,
  icon: Icon = Upload,
  uploadedPath,
  previewUrl,
  onUploaded,
}: {
  docKey: DocKey;
  label: string;
  icon?: LucideIcon;
  uploadedPath: string;
  previewUrl: string;
  onUploaded: (key: DocKey, path: string, previewUrl: string) => void;
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!user) { toast.error("请先登录"); navigate("/auth"); return; }
    if (!ACCEPTED_TYPES.includes(file.type)) { toast.error("仅支持 JPG / PNG / WEBP"); return; }
    if (file.size > MAX_FILE_BYTES) { toast.error("图片不能大于 5MB"); return; }
    setUploading(true); setProgress(8);
    const localUrl = URL.createObjectURL(file);
    const tick = window.setInterval(() => setProgress((p) => (p < 85 ? p + 7 : p)), 120);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${docKey}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("driver-documents").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      setProgress(100);
      onUploaded(docKey, path, localUrl);
      toast.success("上传成功");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传失败");
    } finally {
      window.clearInterval(tick);
      setTimeout(() => { setUploading(false); setProgress(0); }, 300);
    }
  };

  const uploaded = !!uploadedPath;
  return (
    <div className={cn(
      "relative w-full bg-card card-shadow rounded-xl p-3 border-2 border-dashed transition-all",
      uploaded ? "border-green-500/60" : "border-border hover:border-primary/40",
    )}>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="w-full flex items-center gap-3 text-left">
        {previewUrl ? (
          <img src={previewUrl} alt={label + " 预览"} className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-border" />
        ) : (
          <div className={cn("w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0", uploaded ? "bg-green-500/10 text-green-600" : "bg-primary/10 text-primary")}>
            <Icon className="w-6 h-6" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            {label}
            {uploaded && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {uploading ? `上传中 ${progress}%` : uploaded ? "已上传 · 点击重新上传" : "点击上传 · JPG/PNG/WEBP · ≤5MB"}
          </div>
          {uploading && <Progress value={progress} className="h-1.5 mt-2" />}
        </div>
        {uploading ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleUpload} />
    </div>
  );
};

/** 申请状态横幅 */
export const ApplicationStatusBanner = ({ app, loading }: { app: LatestApplication | null; loading: boolean }) => {
  if (loading) {
    return (
      <div className="mb-4 rounded-xl border border-border bg-card p-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> 正在加载我的申请记录…
      </div>
    );
  }
  if (!app) return null;
  return (
    <div className={cn(
      "mb-4 rounded-xl border p-4",
      app.status === "pending" && "border-amber-500/40 bg-amber-500/10",
      app.status === "approved" && "border-green-500/40 bg-green-500/10",
      app.status === "rejected" && "border-destructive/40 bg-destructive/10",
    )} role="status">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {app.status === "pending" && <><Loader2 className="w-4 h-4 animate-spin text-amber-600" /><span className="text-amber-700 dark:text-amber-400">审核中</span></>}
        {app.status === "approved" && <><CheckCircle2 className="w-4 h-4 text-green-600" /><span className="text-green-700 dark:text-green-400">已通过</span></>}
        {app.status === "rejected" && <><ShieldCheck className="w-4 h-4 text-destructive" /><span className="text-destructive">未通过</span></>}
        <span className="ml-auto text-[11px] font-normal text-muted-foreground">
          提交于 {new Date(app.created_at).toLocaleDateString("zh-CN")}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
        {app.status === "pending" && "我们已收到您的申请，1–3 个工作日内完成审核。"}
        {app.status === "approved" && "恭喜！您已通过审核，可在「身份切换」中使用对应工作台。"}
        {app.status === "rejected" && (app.review_note || "请根据审核反馈修改资料后重新提交。")}
      </p>
    </div>
  );
};

/** 提交申请：写入 driver_applications 表 */
export const submitApplication = async (payload: Record<string, unknown>) => {
  const { error } = await supabase.from("driver_applications").insert(payload as never);
  return { error };
};
