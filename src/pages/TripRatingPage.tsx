import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BottomCtaShell } from "@/components/BottomCta";

const OVERALL_LABELS = ["很差", "一般", "还行", "满意", "完美"];
const SUBS = [
  { key: "safety_rating", label: "驾驶安全", emoji: "🛡️" },
  { key: "pet_care_rating", label: "宠物呵护", emoji: "🐾" },
  { key: "punctuality_rating", label: "准时", emoji: "⏰" },
  { key: "communication_rating", label: "协调沟通", emoji: "💬" },
] as const;
const QUICK_TAGS = ["开车很稳", "对宠物温柔", "准时到达", "车内整洁", "服务周到", "沟通顺畅", "拍照贴心", "全程有空调"];

type SubKey = (typeof SUBS)[number]["key"];

const StarRow = ({ value, onChange, size = 28 }: { value: number; onChange: (n: number) => void; size?: number }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} onClick={() => onChange(n)} aria-label={`${n}星`} className="transition-transform active:scale-90">
        <Star
          style={{ width: size, height: size }}
          className={cn("transition-colors", n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
        />
      </button>
    ))}
  </div>
);

const TripRatingPage = () => {
  const navigate = useNavigate();
  const { id: orderId } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [overall, setOverall] = useState(5);
  const [subs, setSubs] = useState<Record<SubKey, number>>({
    safety_rating: 5,
    pet_care_rating: 5,
    punctuality_rating: 5,
    communication_rating: 5,
  });
  const [tags, setTags] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!orderId) return;
    supabase.from("orders").select("id, order_no, driver_id, service_type").eq("id", orderId).maybeSingle().then(({ data }) => setOrder(data));
  }, [orderId, user, authLoading]);

  const toggleTag = (t: string) => setTags((arr) => (arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t]));

  const submit = async () => {
    if (!user || !orderId) return;
    setSubmitting(true);
    const { error } = await supabase.from("trip_ratings").insert({
      order_id: orderId,
      user_id: user.id,
      driver_id: order?.driver_id ?? null,
      overall_rating: overall,
      ...subs,
      quick_tags: tags,
      feedback: feedback || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "提交失败", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "感谢评价 🎉", description: "你的反馈会帮助司机进步" });
    navigate(`/order/${orderId}`);
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2" aria-label="返回">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">评价行程</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* 总体评分 */}
        <section className="rounded-2xl border bg-card p-5 text-center shadow-sm">
          <p className="text-sm text-muted-foreground mb-2">本次行程整体感受</p>
          <div className="flex justify-center mb-2">
            <StarRow value={overall} onChange={setOverall} size={36} />
          </div>
          <p className="text-2xl font-semibold text-amber-500">{OVERALL_LABELS[overall - 1]}</p>
          <p className="text-xs text-muted-foreground mt-1">点击星星切换档位</p>
        </section>

        {/* 四细项评分 */}
        <section className="rounded-2xl border bg-card p-4 space-y-3 shadow-sm">
          <h2 className="text-sm font-semibold">细项评分</h2>
          {SUBS.map((s) => (
            <div key={s.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span>{s.emoji}</span>
                <span>{s.label}</span>
              </div>
              <StarRow value={subs[s.key]} onChange={(n) => setSubs((p) => ({ ...p, [s.key]: n }))} size={22} />
            </div>
          ))}
        </section>

        {/* 快捷标签 */}
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-3">夸夸司机（可多选）</h2>
          <div className="flex flex-wrap gap-2">
            {QUICK_TAGS.map((t) => {
              const active = tags.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTag(t)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm border transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border",
                  )}
                >
                  {active && "✓ "}
                  {t}
                </button>
              );
            })}
          </div>
        </section>

        {/* 文字反馈 */}
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-2">文字反馈（选填）</h2>
          <Textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="说说你的感受…" />
        </section>
      </main>

      <BottomCtaShell offset="bottom" className="bg-background/95 backdrop-blur border-t p-4">
        <div className="max-w-md mx-auto">
          <Button className="w-full h-12" onClick={submit} disabled={submitting}>
            {submitting ? "提交中…" : "提交评价"}
          </Button>
        </div>
      </BottomCtaShell>
    </div>
  );
};

export default TripRatingPage;
