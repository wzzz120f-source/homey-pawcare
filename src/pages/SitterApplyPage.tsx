import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { ArrowLeft, Heart, MapPin, Clock, PawPrint, CheckCircle2, Sparkles } from "lucide-react";
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

const REQUIRED_DOCS: DocKey[] = ["id_card_front_url", "id_card_back_url", "handheld_id_url"];

const TIME_SLOTS = [
  { id: "morning", label: "🌅 早 06–10" },
  { id: "noon", label: "🌤 午 10–14" },
  { id: "afternoon", label: "☀️ 下午 14–18" },
  { id: "evening", label: "🌙 晚 18–22" },
];

const PET_EXPERIENCE = [
  { id: "owner", label: "🐶 自家养过宠物" },
  { id: "vet", label: "🩺 宠物医院 / 助理" },
  { id: "shelter", label: "🏠 救助站志愿者" },
  { id: "trainer", label: "🦮 宠物训练师" },
  { id: "none", label: "💡 仅有热爱，无经验" },
];

const schema = z.object({
  full_name: z.string().trim().min(2, "请输入真实姓名").max(20),
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
  gender: z.enum(["male", "female"]),
  service_area: z.string().trim().min(2, "请输入服务区域"),
  time_slots: z.array(z.string()).min(1, "请至少选择一个上门时段"),
  pet_experience: z.array(z.string()).min(1, "请至少选择一项宠物经验"),
});

const SitterApplyPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sp] = useSearchParams();
  const returnUrl = sp.get("return");
  const { latestApp, initialPreviews, loadingApp } = useLatestApplication("sitter");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [serviceArea, setServiceArea] = useState("");
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [petExp, setPetExp] = useState<string[]>([]);
  const [docs, setDocs] = useState<Partial<Record<DocKey, string>>>({});
  const [previews, setPreviews] = useState<Partial<Record<DocKey, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (latestApp) {
      setDocs(latestApp.paths);
      setPreviews(initialPreviews);
    }
  }, [latestApp, initialPreviews]);

  const toggle = (arr: string[], setArr: (v: string[]) => void, id: string) =>
    setArr(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const handleSubmit = async () => {
    if (!user) { toast.error("请先登录"); navigate("/auth"); return; }
    const parsed = schema.safeParse({
      full_name: fullName, phone, gender,
      service_area: serviceArea,
      time_slots: timeSlots,
      pet_experience: petExp,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "请检查表单"); return; }
    const missing = REQUIRED_DOCS.filter((k) => !docs[k]);
    if (missing.length) { toast.error("请上传：" + missing.map((k) => DOC_DEFAULTS[k].label).join("、")); return; }

    setSubmitting(true);
    // 把 sitter 独有字段折叠进 pet_experience 数组（避免改 schema）
    const tagged = [
      ...parsed.data.pet_experience,
      ...parsed.data.time_slots.map((t) => `slot:${t}`),
      `area:${parsed.data.service_area}`,
    ];
    const { error } = await submitApplication({
      user_id: user.id,
      role_requested: "sitter",
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
    toast.success("宠托师申请已提交，1–3 个工作日内审核");
    navigate(returnUrl || "/profile");
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} aria-label="返回" className="p-2 rounded-lg hover:bg-secondary min-w-[44px] min-h-[44px] flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-extrabold text-lg">守护者入驻 · 宠托师</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pt-4 space-y-5">
        <ApplicationStatusBanner app={latestApp} loading={loadingApp} />

        {/* Hero */}
        <section className="rounded-2xl bg-gradient-to-br from-amber-200/40 via-amber-100/20 to-transparent border border-amber-300/40 p-5">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-xs font-semibold mb-2">
            <Heart className="w-4 h-4" /> 宠托师招募中
          </div>
          <h2 className="text-2xl font-extrabold text-foreground leading-tight mb-1">灵活兼职 · 上门陪伴</h2>
          <p className="text-sm text-muted-foreground">按次结算，自选时段与服务半径，与毛孩子建立信任。</p>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div><p className="text-lg font-extrabold text-amber-600">¥80–150</p><p className="text-[11px] text-muted-foreground">单次报酬</p></div>
            <div><p className="text-lg font-extrabold text-amber-600">自选</p><p className="text-[11px] text-muted-foreground">时段/区域</p></div>
            <div><p className="text-lg font-extrabold text-amber-600">3 项</p><p className="text-[11px] text-muted-foreground">材料即可</p></div>
          </div>
        </section>

        {/* 资料 */}
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
                <button key={g} type="button" onClick={() => setGender(g)} className={cn("py-2.5 rounded-lg text-sm font-medium border transition-all", gender === g ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-muted-foreground")}>
                  {g === "male" ? "👨 男" : "👩 女"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="service_area"><MapPin className="inline w-3.5 h-3.5 mr-1" />常驻服务区域</Label>
            <Input id="service_area" value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder="如：上海浦东 / 静安寺 3 公里内" />
          </div>
          <div>
            <Label><Clock className="inline w-3.5 h-3.5 mr-1" />可上门时段（多选）</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {TIME_SLOTS.map((t) => (
                <label key={t.id} className={cn("flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer", timeSlots.includes(t.id) ? "bg-primary/10 border-primary" : "bg-card border-border")}>
                  <Checkbox checked={timeSlots.includes(t.id)} onCheckedChange={() => toggle(timeSlots, setTimeSlots, t.id)} />
                  <span className="text-sm">{t.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label><PawPrint className="inline w-3.5 h-3.5 mr-1" />宠物经验（多选）</Label>
            <div className="grid grid-cols-1 gap-2 mt-1">
              {PET_EXPERIENCE.map((p) => (
                <label key={p.id} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer", petExp.includes(p.id) ? "bg-primary/10 border-primary" : "bg-card border-border")}>
                  <Checkbox checked={petExp.includes(p.id)} onCheckedChange={() => toggle(petExp, setPetExp, p.id)} />
                  <span className="text-sm">{p.label}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* 证件 */}
        <section className="space-y-3">
          <h3 className="font-bold text-foreground flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" />必传证件（3 项）</h3>
          {REQUIRED_DOCS.map((k) => (
            <DocUploader
              key={k}
              docKey={k}
              label={DOC_DEFAULTS[k].label}
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

        <Button variant="hero" size="xl" className="w-full" disabled={submitting || loadingApp || latestApp?.status === "pending" || latestApp?.status === "approved"} onClick={handleSubmit}>
          {submitting ? "提交中…" : loadingApp ? "校验申请状态…" : latestApp?.status === "pending" ? "审核中" : latestApp?.status === "approved" ? "已通过" : latestApp?.status === "rejected" ? "重新提交" : "提交申请"}
        </Button>
      </main>
    </div>
  );
};

export default SitterApplyPage;
