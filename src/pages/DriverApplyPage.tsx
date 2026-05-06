import { useState, useRef, useEffect, useMemo, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  ArrowLeft,
  TrendingUp,
  Wallet,
  CalendarCheck,
  Users,
  ShieldCheck,
  Upload,
  CheckCircle2,
  Loader2,
  PawPrint,
  Car,
  IdCard,
  FileText,
  User as UserIcon,
  Building2,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DriverCertificationQuiz from "@/components/DriverCertificationQuiz";

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

type ApplicationStatus = "pending" | "approved" | "rejected";
type ApplicantKind = "individual" | "institution";
type StepKey = "intro" | "identity" | "profile" | "docs" | "exam";

interface LatestApplication {
  id: string;
  status: ApplicationStatus;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────
const INCOME_STATS = [
  { icon: TrendingUp, label: "月均收入", value: "¥8,500", note: "全职司机" },
  { icon: Wallet, label: "单笔报酬", value: "¥35–88", note: "按档位" },
  { icon: CalendarCheck, label: "灵活接单", value: "自由排班", note: "随时上线" },
  { icon: Users, label: "已入驻", value: "1,280+", note: "认证司机" },
];

const REQUIREMENTS = [
  "年龄 22–55 岁,持 C1 及以上驾照满 3 年",
  "名下或可使用车辆 5 年内、车况良好",
  "热爱小动物,无虐待动物记录",
  "无重大交通违法 / 犯罪记录",
];

const STEPS: { key: StepKey; title: string; short: string }[] = [
  { key: "intro", title: "了解权益", short: "卖点" },
  { key: "identity", title: "选择身份", short: "身份" },
  { key: "profile", title: "填写资料", short: "资料" },
  { key: "docs", title: "上传证件", short: "证件" },
  { key: "exam", title: "在线认证", short: "认证" },
];

const FLOW_STEPS = [
  { step: 1, title: "在线注册", desc: "填写资料、上传证件" },
  { step: 2, title: "在线认证", desc: "宠物常识 5 题考核" },
  { step: 3, title: "平台审核", desc: "1–3 个工作日完成" },
  { step: 4, title: "接单上线", desc: "通过即可开始接单" },
];

const VEHICLE_TYPES = ["轿车", "SUV", "MPV", "新能源"] as const;

const PET_EXPERIENCE = [
  { id: "owner", label: "🐶 自家养过宠物" },
  { id: "groomer", label: "✂️ 宠物美容师" },
  { id: "vet", label: "🩺 宠物医院 / 助理" },
  { id: "shelter", label: "🏠 救助站志愿者" },
  { id: "trainer", label: "🦮 宠物训练师" },
  { id: "none", label: "💡 仅有热爱,无经验" },
];

const DOC_FIELDS = [
  { key: "id_card_front_url", label: "身份证 · 人像面", icon: IdCard },
  { key: "id_card_back_url", label: "身份证 · 国徽面", icon: IdCard },
  { key: "driver_license_url", label: "驾驶证", icon: FileText },
  { key: "vehicle_license_url", label: "行驶证", icon: Car },
  { key: "handheld_id_url", label: "手持身份证照片", icon: ShieldCheck },
] as const;

type DocKey = (typeof DOC_FIELDS)[number]["key"];

// ─── Validation ────────────────────────────────────────────────────────────
const profileSchema = z.object({
  full_name: z.string().trim().min(2, "请输入真实姓名").max(20),
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
  gender: z.enum(["male", "female"]),
  driving_years: z.number().int().min(3, "驾龄需满 3 年").max(50),
  vehicle_type: z.enum(VEHICLE_TYPES),
  pet_experience: z.array(z.string()).min(1, "请至少选择一项宠物经验"),
});

// ─── Component ─────────────────────────────────────────────────────────────
const DriverApplyPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<StepKey>("intro");
  const [applicantKind, setApplicantKind] = useState<ApplicantKind>("individual");
  const [examPassed, setExamPassed] = useState(false);

  // Profile state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [drivingYears, setDrivingYears] = useState<string>("");
  const [vehicleType, setVehicleType] = useState<(typeof VEHICLE_TYPES)[number]>("轿车");
  const [petExp, setPetExp] = useState<string[]>([]);

  // Docs state
  const [docs, setDocs] = useState<Record<DocKey, string>>({
    id_card_front_url: "",
    id_card_back_url: "",
    driver_license_url: "",
    vehicle_license_url: "",
    handheld_id_url: "",
  });
  /** key → blob/objectURL（本地预览）或 signed URL（已存在的） */
  const [previews, setPreviews] = useState<Record<DocKey, string>>({
    id_card_front_url: "",
    id_card_back_url: "",
    driver_license_url: "",
    vehicle_license_url: "",
    handheld_id_url: "",
  });
  const [uploading, setUploading] = useState<DocKey | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [latestApp, setLatestApp] = useState<LatestApplication | null>(null);
  const [loadingApp, setLoadingApp] = useState(true);
  const fileRefs = useRef<Record<DocKey, HTMLInputElement | null>>({
    id_card_front_url: null,
    id_card_back_url: null,
    driver_license_url: null,
    vehicle_license_url: null,
    handheld_id_url: null,
  });

  // ─── Auto-fetch latest application ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) {
        setLoadingApp(false);
        return;
      }
      setLoadingApp(true);
      const { data, error } = await supabase
        .from("driver_applications")
        .select("id,status,review_note,created_at,reviewed_at,id_card_front_url,id_card_back_url,driver_license_url,vehicle_license_url,handheld_id_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast.error("加载申请记录失败");
      } else if (data) {
        setLatestApp({
          id: data.id,
          status: data.status as ApplicationStatus,
          review_note: data.review_note,
          created_at: data.created_at,
          reviewed_at: data.reviewed_at,
        });
        // pre-fill doc paths + signed urls for previews
        const docKeys: DocKey[] = [
          "id_card_front_url",
          "id_card_back_url",
          "driver_license_url",
          "vehicle_license_url",
          "handheld_id_url",
        ];
        const nextDocs: Record<DocKey, string> = { ...docs };
        const nextPrev: Record<DocKey, string> = { ...previews };
        for (const k of docKeys) {
          const path = (data as Record<string, unknown>)[k] as string | null;
          if (path) {
            nextDocs[k] = path;
            const { data: signed } = await supabase.storage
              .from("driver-documents")
              .createSignedUrl(path, 3600);
            if (signed?.signedUrl) nextPrev[k] = signed.signedUrl;
          }
        }
        if (!cancelled) {
          setDocs(nextDocs);
          setPreviews(nextPrev);
        }
      }
      if (!cancelled) setLoadingApp(false);
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const togglePetExp = (id: string) => {
    setPetExp((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  };

  const handleUpload = async (key: DocKey, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-uploading same file
    if (!file) return;
    if (!user) {
      toast.error("请先登录");
      navigate("/auth");
      return;
    }
    // Type validation
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("仅支持 JPG / PNG / WEBP 图片");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error(`图片不能大于 ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)}MB`);
      return;
    }
    setUploading(key);
    setUploadProgress(8);
    // Local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreviews((p) => {
      if (p[key]?.startsWith("blob:")) URL.revokeObjectURL(p[key]);
      return { ...p, [key]: localUrl };
    });
    // Simulated progress (Supabase JS doesn't expose upload progress events)
    const tick = window.setInterval(() => {
      setUploadProgress((p) => (p < 85 ? p + 7 : p));
    }, 120);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${key}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("driver-documents").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (error) throw error;
      setDocs((d) => ({ ...d, [key]: path }));
      setUploadProgress(100);
      toast.success("上传成功");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "上传失败");
      // revert preview
      setPreviews((p) => ({ ...p, [key]: "" }));
    } finally {
      window.clearInterval(tick);
      setTimeout(() => {
        setUploading(null);
        setUploadProgress(0);
      }, 300);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("请先登录");
      navigate("/auth");
      return;
    }
    const parsed = profileSchema.safeParse({
      full_name: fullName,
      phone,
      gender,
      driving_years: Number(drivingYears),
      vehicle_type: vehicleType,
      pet_experience: petExp,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "请检查表单");
      setStep("profile");
      return;
    }
    const missing = DOC_FIELDS.filter((f) => !docs[f.key]);
    if (missing.length > 0) {
      toast.error(`请上传:${missing.map((m) => m.label).join("、")}`);
      setStep("docs");
      return;
    }
    if (!examPassed) {
      toast.error("请先完成在线认证测试");
      setStep("exam");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("driver_applications").insert({
        user_id: user.id,
        full_name: parsed.data.full_name,
        phone: parsed.data.phone,
        gender: parsed.data.gender,
        driving_years: parsed.data.driving_years,
        vehicle_type: parsed.data.vehicle_type,
        pet_experience: parsed.data.pet_experience,
        ...docs,
        status: "pending",
      });
      if (error) throw error;
      toast.success("申请已提交，1–3 个工作日内审核");
      navigate("/profile");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-secondary min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="返回"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-extrabold text-lg text-foreground">司机入驻</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pt-4">
        {/* ── Application status banner ── */}
        {loadingApp ? (
          <div className="mb-4 rounded-xl border border-border bg-card p-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> 正在加载我的申请记录…
          </div>
        ) : latestApp ? (
          <div
            className={cn(
              "mb-4 rounded-xl border p-4",
              latestApp.status === "pending" && "border-amber-500/40 bg-amber-500/10",
              latestApp.status === "approved" && "border-green-500/40 bg-green-500/10",
              latestApp.status === "rejected" && "border-destructive/40 bg-destructive/10",
            )}
            role="status"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              {latestApp.status === "pending" && <><Loader2 className="w-4 h-4 animate-spin text-amber-600" /><span className="text-amber-700 dark:text-amber-400">审核中</span></>}
              {latestApp.status === "approved" && <><CheckCircle2 className="w-4 h-4 text-green-600" /><span className="text-green-700 dark:text-green-400">已通过</span></>}
              {latestApp.status === "rejected" && <><ShieldCheck className="w-4 h-4 text-destructive" /><span className="text-destructive">未通过</span></>}
              <span className="ml-auto text-[11px] font-normal text-muted-foreground">
                提交于 {new Date(latestApp.created_at).toLocaleDateString("zh-CN")}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              {latestApp.status === "pending" && "我们已收到您的申请，1–3 个工作日内完成审核。"}
              {latestApp.status === "approved" && "恭喜！您已成为认证萌宠司机，可前往「我的」开始接单。"}
              {latestApp.status === "rejected" && (latestApp.review_note || "请根据审核反馈修改资料后重新提交。")}
            </p>
          </div>
        ) : null}

        {/* ── Latest rejection review note ── */}
        {!loadingApp && latestApp?.status === "rejected" && (
          <section
            className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4"
            aria-label="最近一次审核反馈"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                ❌ 未通过
              </span>
              <span className="text-[11px] text-muted-foreground">
                审核于{" "}
                {(latestApp.reviewed_at
                  ? new Date(latestApp.reviewed_at)
                  : new Date(latestApp.created_at)
                ).toLocaleString("zh-CN", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">审核反馈</h3>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {latestApp.review_note?.trim() || "审核员未填写具体原因，请补充资料后重新提交。"}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              💡 修改完成后，可在「上传证件」标签下点击「重新提交审核」。
            </p>
          </section>
        )}

        <Tabs value={step} onValueChange={(v) => setStep(v as StepKey)} className="w-full">
          {/* 进度条 */}
          {(() => {
            const idx = STEPS.findIndex((s) => s.key === step);
            const pct = ((idx + 1) / STEPS.length) * 100;
            return (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-foreground">
                    第 {idx + 1} / {STEPS.length} 步 · {STEPS[idx]?.title}
                  </span>
                  <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            );
          })()}
          <TabsList className="grid w-full grid-cols-5 mb-4 h-auto">
            {STEPS.map((s) => (
              <TabsTrigger key={s.key} value={s.key} className="text-[11px] px-1 py-1.5">
                {s.short}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Step 1: Intro ── */}
          <TabsContent value="intro" className="space-y-5">
            {/* Hero */}
            <div className="rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 p-5">
              <div className="flex items-center gap-2 text-primary text-xs font-semibold mb-2">
                <PawPrint className="w-4 h-4" /> 萌宠司机招募中
              </div>
              <h2 className="text-2xl font-extrabold text-foreground leading-tight mb-1">
                让爱宠人士的旅途更安心
              </h2>
              <p className="text-sm text-muted-foreground">
                加入平台认证司机，灵活接单、稳定收入，与毛孩子同行。
              </p>
            </div>

            {/* Income stats */}
            <div className="grid grid-cols-2 gap-3">
              {INCOME_STATS.map((s) => (
                <div key={s.label} className="bg-card card-shadow rounded-xl p-3">
                  <s.icon className="w-5 h-5 text-primary mb-2" />
                  <div className="text-lg font-extrabold text-foreground">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label} · {s.note}</div>
                </div>
              ))}
            </div>

            {/* Flow */}
            <section>
              <h3 className="font-bold text-foreground mb-3">📋 注册流程</h3>
              <ol className="space-y-2">
                {FLOW_STEPS.map((f) => (
                  <li
                    key={f.step}
                    className="flex items-start gap-3 bg-card card-shadow rounded-xl p-3"
                  >
                    <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center flex-shrink-0">
                      {f.step}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{f.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{f.desc}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* Requirements */}
            <section>
              <h3 className="font-bold text-foreground mb-3">✅ 基本要求</h3>
              <ul className="bg-card card-shadow rounded-xl p-4 space-y-2">
                {REQUIREMENTS.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </section>

            <Button variant="hero" size="xl" className="w-full" onClick={() => setTab("profile")}>
              立即申请 →
            </Button>
          </TabsContent>

          {/* ── Tab 2: Profile ── */}
          <TabsContent value="profile" className="space-y-4">
            <div className="bg-card card-shadow rounded-xl p-4 space-y-4">
              <div>
                <Label htmlFor="full_name">姓名</Label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="请输入真实姓名"
                  maxLength={20}
                />
              </div>
              <div>
                <Label htmlFor="phone">手机号</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="11 位手机号"
                  inputMode="tel"
                  maxLength={11}
                />
              </div>
              <div>
                <Label>性别</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(["male", "female"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={cn(
                        "py-2.5 rounded-lg text-sm font-medium border transition-all",
                        gender === g
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-card border-border text-muted-foreground",
                      )}
                    >
                      {g === "male" ? "👨 男" : "👩 女"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="driving_years">驾龄（年）</Label>
                <Input
                  id="driving_years"
                  type="number"
                  min={0}
                  max={50}
                  value={drivingYears}
                  onChange={(e) => setDrivingYears(e.target.value)}
                  placeholder="例如 5"
                />
              </div>
              <div>
                <Label>车型</Label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {VEHICLE_TYPES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVehicleType(v)}
                      className={cn(
                        "py-2 rounded-lg text-sm font-medium border transition-all",
                        vehicleType === v
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-card border-border text-muted-foreground",
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>宠物经验（多选）</Label>
                <div className="grid grid-cols-1 gap-2 mt-1">
                  {PET_EXPERIENCE.map((p) => (
                    <label
                      key={p.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all",
                        petExp.includes(p.id)
                          ? "bg-primary/10 border-primary"
                          : "bg-card border-border",
                      )}
                    >
                      <Checkbox
                        checked={petExp.includes(p.id)}
                        onCheckedChange={() => togglePetExp(p.id)}
                      />
                      <span className="text-sm text-foreground">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <Button variant="hero" size="xl" className="w-full" onClick={() => setTab("docs")}>
              下一步：上传证件
            </Button>
          </TabsContent>

          {/* ── Tab 3: Docs ── */}
          <TabsContent value="docs" className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {DOC_FIELDS.map((f) => {
                const uploaded = !!docs[f.key];
                const isUploading = uploading === f.key;
                const previewUrl = previews[f.key];
                return (
                  <div
                    key={f.key}
                    className={cn(
                      "relative w-full bg-card card-shadow rounded-xl p-3 border-2 border-dashed transition-all",
                      uploaded ? "border-green-500/60" : "border-border hover:border-primary/40",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => fileRefs.current[f.key]?.click()}
                      className="w-full flex items-center gap-3 text-left"
                      disabled={isUploading}
                    >
                      {/* Thumbnail or icon */}
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={f.label + " 预览"}
                          className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-border"
                        />
                      ) : (
                        <div
                          className={cn(
                            "w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0",
                            uploaded ? "bg-green-500/10 text-green-600" : "bg-primary/10 text-primary",
                          )}
                        >
                          <f.icon className="w-6 h-6" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          {f.label}
                          {uploaded && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {isUploading
                            ? `上传中 ${uploadProgress}%`
                            : uploaded
                              ? "已上传 · 点击重新上传"
                              : "点击上传 · JPG/PNG/WEBP · ≤5MB"}
                        </div>
                        {isUploading && (
                          <Progress value={uploadProgress} className="h-1.5 mt-2" />
                        )}
                      </div>
                      {isUploading ? (
                        <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
                      ) : (
                        <Upload className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      )}
                    </button>
                    <input
                      ref={(el) => (fileRefs.current[f.key] = el)}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleUpload(f.key, e)}
                    />
                  </div>
                );
              })}
            </div>

            {/* Privacy */}
            <div className="bg-secondary/50 rounded-xl p-4 text-xs text-muted-foreground leading-relaxed">
              <div className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" /> 隐私声明
              </div>
              您上传的证件仅用于身份审核，全程加密存储，平台严格遵守《个人信息保护法》，未经您的同意不会向第三方披露。
            </div>

            <Button
              variant="hero"
              size="xl"
              className="w-full"
              disabled={submitting || latestApp?.status === "pending"}
              onClick={handleSubmit}
            >
              {submitting
                ? "提交中…"
                : latestApp?.status === "pending"
                  ? "审核中，请耐心等待"
                  : latestApp?.status === "rejected"
                    ? "重新提交审核"
                    : "提交审核"}
            </Button>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default DriverApplyPage;
