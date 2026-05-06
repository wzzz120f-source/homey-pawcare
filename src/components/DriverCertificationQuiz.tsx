import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Award, Loader2, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface QuizQuestion {
  id: string;
  question: string;
  options: { key: string; label: string }[];
  correct: string;
  explanation: string;
}

const QUESTIONS: QuizQuestion[] = [
  {
    id: "q1",
    question: "运送陌生宠物时,以下哪种做法最安全?",
    options: [
      { key: "A", label: "让宠物在副驾驶自由活动" },
      { key: "B", label: "使用航空箱或安全带固定的宠物座椅" },
      { key: "C", label: "抱在怀里安抚情绪" },
      { key: "D", label: "放后备箱避免影响驾驶" },
    ],
    correct: "B",
    explanation: "航空箱/宠物安全座椅可有效防止急刹车造成的二次伤害,是最安全的运输方式。",
  },
  {
    id: "q2",
    question: "夏季 35°C 高温下,宠物在车内独自停留多久就可能中暑?",
    options: [
      { key: "A", label: "30 分钟内都安全" },
      { key: "B", label: "10 分钟内即可能中暑" },
      { key: "C", label: "1 小时内开窗即可" },
      { key: "D", label: "只要熄火就没事" },
    ],
    correct: "B",
    explanation: "车内温度上升极快,即使开窗,10 分钟内宠物也可能因热射病死亡。",
  },
  {
    id: "q3",
    question: "运送途中宠物突发呕吐/抽搐,正确做法是?",
    options: [
      { key: "A", label: "强行喂水让其平静" },
      { key: "B", label: "立即靠边停车,联系平台客服与车主" },
      { key: "C", label: "继续前往目的地再说" },
      { key: "D", label: "拍打安抚" },
    ],
    correct: "B",
    explanation: "应立刻停车避免危险,通过 App 一键报警并联系车主,严重时就近送医。",
  },
  {
    id: "q4",
    question: "猫咪在运输笼中持续低吼/炸毛时,你应该?",
    options: [
      { key: "A", label: "打开笼门安抚" },
      { key: "B", label: "用毛巾遮盖笼子,降低视觉刺激" },
      { key: "C", label: "用力摇晃笼子让其安静" },
      { key: "D", label: "大声呼喊它的名字" },
    ],
    correct: "B",
    explanation: "猫咪应激时遮盖笼子能降低视觉刺激,有效缓解紧张情绪,切勿打开笼门。",
  },
  {
    id: "q5",
    question: "上门接宠时,主人不在家但门未锁,你应该?",
    options: [
      { key: "A", label: "直接进门接宠物" },
      { key: "B", label: "拒绝服务,等待车主到达或在 App 内取消" },
      { key: "C", label: "先和邻居打个招呼再进" },
      { key: "D", label: "拍照留证后进门" },
    ],
    correct: "B",
    explanation: "未经车主确认入户存在重大安全/隐私风险,平台严禁此类行为。",
  },
];

const PASS_SCORE = 4; // 5 题答对 4 题及以上为通过

interface Props {
  onComplete?: (passed: boolean, score: number) => void;
}

const DriverCertificationQuiz = ({ onComplete }: Props) => {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState(0);

  const handleSelect = (qid: string, key: string) => {
    if (submitted) return;
    setAnswers((a) => ({ ...a, [qid]: key }));
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < QUESTIONS.length) {
      toast.error(`请回答全部 ${QUESTIONS.length} 道题`);
      return;
    }
    const correct = QUESTIONS.filter((q) => answers[q.id] === q.correct).length;
    const passed = correct >= PASS_SCORE;
    setScore(correct);
    setSubmitted(true);
    setSubmitting(true);
    try {
      if (user) {
        await supabase.from("driver_certification_tests").insert({
          user_id: user.id,
          score: correct,
          total_questions: QUESTIONS.length,
          passed,
          answers,
        });
      }
      passed ? toast.success(`恭喜通过 ${correct}/${QUESTIONS.length} 分`) : toast.error(`未通过 (${correct}/${QUESTIONS.length}),请重新作答`);
      onComplete?.(passed, correct);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setAnswers({});
    setSubmitted(false);
    setScore(0);
  };

  const passed = score >= PASS_SCORE;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 p-4">
        <div className="flex items-center gap-2 text-primary text-xs font-semibold mb-1.5">
          <Award className="w-4 h-4" /> 宠物护理基础认证
        </div>
        <p className="text-sm text-foreground font-semibold mb-1">
          5 道题 · 答对 {PASS_SCORE} 题及以上视为通过
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          本测试帮助平台筛选具备基础宠物常识的宠托师,通过后即可解锁接单权限。
        </p>
      </div>

      {QUESTIONS.map((q, idx) => (
        <div key={q.id} className="bg-card card-shadow rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
              {idx + 1}
            </span>
            <p className="text-sm font-semibold text-foreground leading-relaxed">{q.question}</p>
          </div>
          <div className="grid gap-2">
            {q.options.map((opt) => {
              const selected = answers[q.id] === opt.key;
              const isCorrect = opt.key === q.correct;
              const showRight = submitted && isCorrect;
              const showWrong = submitted && selected && !isCorrect;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleSelect(q.id, opt.key)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left text-sm transition-all min-h-[44px]",
                    !submitted && selected && "bg-primary/10 border-primary text-primary",
                    !submitted && !selected && "bg-card border-border text-foreground hover:border-primary/40",
                    showRight && "bg-green-500/10 border-green-500 text-green-700 dark:text-green-400",
                    showWrong && "bg-destructive/10 border-destructive text-destructive",
                    submitted && !selected && !isCorrect && "opacity-60",
                  )}
                  disabled={submitted}
                >
                  <span className="font-bold">{opt.key}.</span>
                  <span className="flex-1">{opt.label}</span>
                  {showRight && <CheckCircle2 className="w-4 h-4" />}
                  {showWrong && <XCircle className="w-4 h-4" />}
                </button>
              );
            })}
          </div>
          {submitted && (
            <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-2.5 leading-relaxed">
              💡 {q.explanation}
            </div>
          )}
        </div>
      ))}

      {!submitted ? (
        <Button variant="hero" size="xl" className="w-full" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "提交答题"}
        </Button>
      ) : (
        <div className="space-y-3">
          <div
            className={cn(
              "rounded-2xl p-5 text-center",
              passed
                ? "bg-green-500/10 border border-green-500/40"
                : "bg-destructive/10 border border-destructive/40",
            )}
          >
            <Award className={cn("w-10 h-10 mx-auto mb-2", passed ? "text-green-600" : "text-destructive")} />
            <p className="text-2xl font-extrabold text-foreground">
              {score}/{QUESTIONS.length} 分
            </p>
            <p className={cn("text-sm font-semibold mt-1", passed ? "text-green-700 dark:text-green-400" : "text-destructive")}>
              {passed ? "🎉 已通过认证" : "未达标,请重新作答"}
            </p>
          </div>
          {!passed && (
            <Button variant="outline" size="lg" className="w-full gap-2" onClick={handleReset}>
              <RotateCw className="w-4 h-4" /> 重新作答
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default DriverCertificationQuiz;
