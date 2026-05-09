import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { ArrowLeft, Scissors, Award, Stethoscope, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  ApplicationStatusBanner,
  DocUploader,
  DOC_DEFAULTS,
  submitApplication,
  useLatestApplication,
  type DocKey,
} from "./apply/_shared";

// 复用 driver_license_url 字段存储「美容师/兽医资质证」
const REQUIRED_DOCS: DocKey[] = ["id_card_front_url", "id_card_back_url", "handheld_id_url", "driver_license_url"];
const DOC_LABEL_OVERRIDES: Partial<Record<DocKey, string>> = {
  driver_license_url: "专业资质（美容证 / 兽医证）",
};

const SPECIALTIES = [
  { id: "bath", label: "🛁 基础洗护" },
  { id: "spa", label: "💆 SPA / 精修" },
  { id: "medical", label: "💉 医疗护理" },
  { id: "dental", label: "🦷 口腔护理" },
  { id: "elderly", label: "🐕‍🦺 老年宠物" },
];

const LEVELS = [
  { value: "junior", label: "初级（< 1 年）" },
  { value: "intermediate", label: "中级（1–3 年）" },
  { value: "senior", label: "高级（3–5 年）" },
  { value: "expert", label: "资深（5 年以上）" },
];

const schema = z.object({
  full_name: z.string().trim().min(2, "请输入真实姓名").max(20),
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
  gender: z.enum(["male", "female"]),
  working_years: z.number().int().min(0).max(50),
  level: z.enum(["junior", "intermediate", "senior", "expert"]),
  specialties: z.array(z.string()).min(1, "请至少选择一项擅长品类"),
});

const GroomerApplyPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sp] = useSearchParams();
  const returnUrl = sp.get("return");
  const { latestApp, initialPreviews, loadingApp } = useLatestApplication("groomer");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"male" | "female">("female");
  const [years, setYears] = useState("");
  const [level, setLevel] = useState<"junior" | "intermediate" | "senior" | "expert">("intermediate");
  const [specs, setSpecs] = useState<string[]>([]);
  const [docs, setDocs] = useState<Partial<Record<DocKey, string>>>({});
  const [previews, setPreviews] = useState<Partial<Record<DocKey, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (latestApp) {
      setDocs(latestApp.paths);
      setPreviews(initialPreviews);
    }
  }, [latestApp, initialPreviews]);

  const handleSubmit = async () => {
    if (!user) { toast.error("请先登录"); navigate("/auth"); return; }
    const parsed = schema.safeParse({
      full_name: fullName, phone, gender,
      working_years: Number(years || 0),
      level, specialties: specs,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "请检查表单"); return; }
    const missing = REQUIRED_DOCS.filter((k) => !docs[k]);
    if (missing.length) {
      toast.error("请上传：" + missing.map((k) => DOC_LABEL_OVERRIDES[k] || DOC_DEFAULTS[k].label).join("、"));
      return;
    }

    setSubmitting(true);
    const tagged = [
      ...parsed.data.specialties.map((s) => `spec:${s}`),
      `level:${parsed.data.level}`,
      `years:${parsed.data.working_years}`,
    ];
    const { error } = await submitApplication({
      user_id: user.id,
      role_requested: "groomer",
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      gender: parsed.data.gender,
      pet_experience: tagged,
      driving_years: 0,
      vehicle_type: "无",
      ...Object.fromEntries(REQUIRED_DOCS.map((k) => [k, docs[k]])),
      status: "pending",
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("护理师申请已提交，1–3 个工作日内审核");
    navigate(returnUrl || "/profile");
  };

  const toggleSpec = (id: string) =>
    setSpecs((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  return (
    <div className="min-h-screen bg-background pb-nav">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} aria-label="返回" className="p-2 rounded-lg hover:bg-secondary min-w-[44px] min-h-[44px] flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-extrabold text-lg">守护者入驻 · 护理师</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pt-4 space-y-5">
        <ApplicationStatusBanner app={latestApp} loading={loadingApp} />

        <section className="rounded-2xl bg-gradient-to-br from-emerald-200/30 via-emerald-100/20 to-transparent border border-emerald-400/40 p-5">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs font-semibold mb-2">
            <Scissors className="w-4 h-4" /> 护理师招募中
          </div>
          <h2 className="text-2xl font-extrabold text-foreground leading-tight mb-1">专业认证 · 等级徽章</h2>
          <p className="text-sm text-muted-foreground">凭资质入驻，工作室派单，享受平台流量与等级激励。</p>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div><p className="text-lg font-extrabold text-emerald-700">¥120–500</p><p className="text-[11px] text-muted-foreground">单次报酬</p></div>
            <div><p className="text-lg font-extrabold text-emerald-700">4 等级</p><p className="text-[11px] text-muted-foreground">徽章激励</p></div>
            <div><p className="text-lg font-extrabold text-emerald-700">需资质</p><p className="text-[11px] text-muted-foreground">美容/兽医</p></div>
          </div>
        </section>

        <section className="bg-card card-shadow rounded-xl p-4 space-y-4">
          <h3 className="font-bold text-foreground flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />基础资料</h3>
          <div>
            <Label htmlFor="full_name">姓名</Label>
            <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="请输入真实姓名" maxLength={20} />
          </div>
          <div>
            <Label htmlFor="phone">手机号</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11 位手机号" inputMode="tel" maxLength={11} />
          </div>
          <div>
            <Label>性别</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(["male", "female"] as const).map((g) => (
                <button key={g} type="button" onClick={() => setGender(g)} className={cn("py-2.5 rounded-lg text-sm font-medium border", gender === g ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-muted-foreground")}>
                  {g === "male" ? "👨 男" : "👩 女"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="years"><Award className="inline w-3.5 h-3.5 mr-1" />从业年限（年）</Label>
            <Input id="years" type="number" min={0} max={50} value={years} onChange={(e) => setYears(e.target.value)} placeholder="如 3" />
          </div>
          <div>
            <Label>自评等级</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {LEVELS.map((l) => (
                <button key={l.value} type="button" onClick={() => setLevel(l.value as typeof level)} className={cn("py-2.5 rounded-lg text-xs font-medium border", level === l.value ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-muted-foreground")}>
                  {l.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">通过审核后等级会同步到工作台健康评估表单。</p>
          </div>
          <div>
            <Label><Stethoscope className="inline w-3.5 h-3.5 mr-1" />擅长品类（多选）</Label>
            <div className="grid grid-cols-1 gap-2 mt-1">
              {SPECIALTIES.map((s) => (
                <label key={s.id} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer", specs.includes(s.id) ? "bg-primary/10 border-primary" : "bg-card border-border")}>
                  <Checkbox checked={specs.includes(s.id)} onCheckedChange={() => toggleSpec(s.id)} />
                  <span className="text-sm">{s.label}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="font-bold text-foreground flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" />必传证件（4 项）</h3>
          {REQUIRED_DOCS.map((k) => (
            <DocUploader
              key={k}
              docKey={k}
              label={DOC_LABEL_OVERRIDES[k] || DOC_DEFAULTS[k].label}
              icon={DOC_DEFAULTS[k].icon}
              uploadedPath={docs[k] || ""}
              previewUrl={previews[k] || ""}
              onUploaded={(key, path, prev) => {
                setDocs((d) => ({ ...d, [key]: path }));
                setPreviews((p) => ({ ...p, [key]: prev }));
              }}
            />
          ))}
        </section>

        <Button variant="hero" size="xl" className="w-full" disabled={submitting || latestApp?.status === "pending"} onClick={handleSubmit}>
          {submitting ? "提交中…" : latestApp?.status === "pending" ? "审核中" : latestApp?.status === "rejected" ? "重新提交" : "提交申请"}
        </Button>
      </main>
    </div>
  );
};

export default GroomerApplyPage;
