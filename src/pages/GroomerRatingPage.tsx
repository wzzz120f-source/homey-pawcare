import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const TAG_POOL = ["手法温柔", "环境干净", "造型满意", "用品讲究", "宠物状态稳定", "服务专业"];

function StarRow({
  label,
  value,
  onChange,
  reverse,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  reverse?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" onClick={() => onChange(i)} aria-label={`${label}-${i}`}>
            <Star
              className={cn(
                "w-6 h-6",
                i <= value
                  ? reverse
                    ? "fill-destructive text-destructive"
                    : "fill-primary text-primary"
                  : "text-muted-foreground/40",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GroomerRatingPage() {
  const { id: orderId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [overall, setOverall] = useState(5);
  const [gentleness, setGentleness] = useState(5);
  const [technique, setTechnique] = useState(5);
  const [envClean, setEnvClean] = useState(5);
  const [petStress, setPetStress] = useState(1);
  const [tags, setTags] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [groomerId, setGroomerId] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    supabase
      .from("orders")
      .select("driver_id")
      .eq("id", orderId)
      .maybeSingle()
      .then(({ data }) => setGroomerId((data as any)?.driver_id ?? null));
  }, [orderId]);

  const submit = async () => {
    if (!user || !orderId || !groomerId) {
      toast({ title: "信息不全", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("groomer_ratings").insert({
      order_id: orderId,
      user_id: user.id,
      groomer_id: groomerId,
      overall,
      gentleness,
      technique,
      env_clean: envClean,
      pet_stress_level: petStress,
      tags,
      content: content.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "提交失败", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "评价已提交", description: "感谢您的反馈" });
    navigate("/orders");
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-40 bg-card border-b px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary" aria-label="返回">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-extrabold flex-1">洗护评价</h1>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        <section className="rounded-2xl bg-card p-4 card-shadow divide-y">
          <StarRow label="总体满意度" value={overall} onChange={setOverall} />
          <StarRow label="手法温柔度" value={gentleness} onChange={setGentleness} hint="操作是否轻柔" />
          <StarRow label="专业技术" value={technique} onChange={setTechnique} hint="造型与技法" />
          <StarRow label="环境清洁" value={envClean} onChange={setEnvClean} />
          <StarRow
            label="宠物压力指数"
            value={petStress}
            onChange={setPetStress}
            reverse
            hint="星越多表示宠物越紧张（越低越好）"
          />
        </section>

        <section className="rounded-2xl bg-card p-4 card-shadow">
          <p className="text-sm font-semibold mb-2">满意点（可多选）</p>
          <div className="flex flex-wrap gap-2">
            {TAG_POOL.map((t) => {
              const on = tags.includes(t);
              return (
                <Badge
                  key={t}
                  variant={on ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setTags((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))}
                >
                  {t}
                </Badge>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl bg-card p-4 card-shadow">
          <Textarea
            placeholder="说说本次洗护的体验…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
          />
        </section>

        <Button variant="hero" className="w-full" disabled={submitting} onClick={submit}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          提交评价
        </Button>
      </main>
    </div>
  );
}
