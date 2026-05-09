import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, Sparkles, Loader2, HeartPulse, Activity, Scale, Brush } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type GroomerLevel = "junior" | "intermediate" | "senior" | "expert";

const LEVEL_META: Record<GroomerLevel, { label: string; badge: string; ring: string; desc: string }> = {
  junior: {
    label: "初级护理师",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    ring: "ring-emerald-300",
    desc: "可执行基础体征采集与日常护理",
  },
  intermediate: {
    label: "中级护理师",
    badge: "bg-teal-100 text-teal-700 border-teal-200",
    ring: "ring-teal-300",
    desc: "可独立完成结构化健康评估",
  },
  senior: {
    label: "高级护理师",
    badge: "bg-[hsl(146_50%_36%_/_0.15)] text-[hsl(146_50%_28%)] border-[hsl(146_50%_36%_/_0.35)]",
    ring: "ring-[hsl(146_50%_36%)]",
    desc: "可输出医疗建议并指导初级人员",
  },
  expert: {
    label: "资深护理师",
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    ring: "ring-amber-400",
    desc: "可处理疑难病例并承担质量复核",
  },
};

interface FieldDef {
  key: string;
  label: string;
  unit?: string;
  placeholder?: string;
  type?: "number" | "text";
  icon?: any;
}

const TEMPLATE: { section: string; fields: FieldDef[] }[] = [
  {
    section: "基础体征",
    fields: [
      { key: "temp", label: "体温", unit: "°C", placeholder: "38.5", type: "number", icon: HeartPulse },
      { key: "heart", label: "心率", unit: "bpm", placeholder: "100", type: "number", icon: Activity },
      { key: "weight", label: "体重", unit: "kg", placeholder: "5.2", type: "number", icon: Scale },
    ],
  },
  {
    section: "外观与行为",
    fields: [
      { key: "coat", label: "毛发状况", placeholder: "光泽 / 打结 / 脱毛", icon: Brush },
      { key: "appetite", label: "食欲", placeholder: "正常 / 减少 / 拒食" },
      { key: "stool", label: "排泄", placeholder: "成形 / 软便 / 腹泻" },
      { key: "behavior", label: "精神状态", placeholder: "活跃 / 萎靡 / 焦虑" },
    ],
  },
];

interface Props {
  level?: GroomerLevel;
  petName?: string;
}

const HealthAssessmentForm = ({ level = "intermediate", petName = "宠物" }: Props) => {
  const meta = LEVEL_META[level];
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [advice, setAdvice] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const completion = useMemo(() => {
    const total = TEMPLATE.reduce((a, s) => a + s.fields.length, 0);
    const done = Object.values(values).filter((v) => v && v.trim()).length;
    return Math.round((done / total) * 100);
  }, [values]);

  const generate = async () => {
    setLoading(true);
    setAdvice("");
    try {
      const summary = TEMPLATE.flatMap((s) =>
        s.fields.map((f) => `${f.label}：${values[f.key] || "未填"}${f.unit ? f.unit : ""}`),
      ).join("；");
      const prompt = `请为${petName}基于以下结构化体检数据，输出 3-5 条专业但通俗的护理与就医建议。${summary}。备注：${notes || "无"}`;
      const { data, error } = await supabase.functions.invoke("ai-summary", {
        body: { prompt, system: "你是一位资深宠物护理师，擅长输出可执行的健康建议。" },
      });
      if (error) throw error;
      setAdvice((data as any)?.text || (data as any)?.summary || "暂无建议");
    } catch (e: any) {
      toast.error("生成失败", { description: e?.message || "AI 服务繁忙，请稍后再试" });
      setAdvice(
        [
          "• 持续观察体温与饮水量，异常时及时复测",
          "• 维持高蛋白易消化饮食，少食多餐",
          "• 若 24 小时无改善建议线下就诊",
        ].join("\n"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className={cn("p-4 border-2 ring-1 ring-offset-0", meta.ring)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-primary" />
            <div>
              <p className="font-bold">结构化健康评估</p>
              <p className="text-xs text-muted-foreground">{meta.desc}</p>
            </div>
          </div>
          <Badge className={cn("border", meta.badge)} variant="outline">
            {meta.label}
          </Badge>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${completion}%` }}
            aria-label={`完成度 ${completion}%`}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">完成度 {completion}%</p>
      </Card>

      {TEMPLATE.map((sec) => (
        <Card key={sec.section} className="p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">{sec.section}</p>
          <div className="grid grid-cols-2 gap-3">
            {sec.fields.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    {Icon && <Icon className="w-3 h-3 text-primary" />}
                    {f.label}
                    {f.unit && <span className="text-muted-foreground">({f.unit})</span>}
                  </Label>
                  <Input
                    type={f.type || "text"}
                    inputMode={f.type === "number" ? "decimal" : undefined}
                    placeholder={f.placeholder}
                    value={values[f.key] || ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    className="h-9 tabular-nums"
                  />
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <Card className="p-4 space-y-2">
        <Label className="text-xs">护理师备注</Label>
        <Textarea
          rows={2}
          placeholder="补充观察、家长反馈或既往病史"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Card>

      <Button onClick={generate} disabled={loading} className="w-full" size="lg">
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
        AI 医疗建议输出
      </Button>

      <Card className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <p className="text-sm font-bold">AI 建议</p>
        </div>
        {advice ? (
          <pre className="text-sm whitespace-pre-wrap leading-relaxed font-sans text-foreground">{advice}</pre>
        ) : (
          <p className="text-xs text-muted-foreground">填写体征后点击上方按钮生成可执行护理建议。</p>
        )}
      </Card>
    </div>
  );
};

export default HealthAssessmentForm;
