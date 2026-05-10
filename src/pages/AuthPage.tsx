import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PawPrint, Mail, Lock, User, ArrowLeft, PawPrint as PawIcon, Briefcase, Stethoscope, Store } from "lucide-react";
import { toast } from "sonner";
import { friendlySupabaseError } from "@/lib/supabaseError";
import { cn } from "@/lib/utils";

type RoleKey = "user" | "sitter" | "groomer" | "merchant";
type Step = "auth" | "role" | "done";

const ROLE_OPTIONS: {
  key: RoleKey;
  title: string;
  subtitle: string;
  icon: typeof PawIcon;
  next: string;
}[] = [
  { key: "user", title: "我是铲屎官", subtitle: "需要上门服务", icon: PawIcon, next: "/pets" },
  { key: "sitter", title: "我是宠托师", subtitle: "兼职照顾宠物", icon: Briefcase, next: "/driver/apply?type=sitter" },
  { key: "groomer", title: "我是护理师", subtitle: "提供专业护理（洗浴/医疗）", icon: Stethoscope, next: "/driver/apply?type=groomer" },
  { key: "merchant", title: "我是商家", subtitle: "实体店铺入驻", icon: Store, next: "/merchant/apply" },
];

const WELCOME = "我们相信，真正爱宠的人，值得被生活温柔以待。Homey 的创立，是为了让每一份对毛孩子的爱都不被辜负，也让每一位守护者都能在善意中获得体面的回报，欢迎加入我们！";

const AuthPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState<Step>(params.get("step") === "role" ? "role" : "auth");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("登录成功!");
        // 开发者（admin）自动进入后台
        const uid = signIn.user?.id;
        if (uid) {
          const { data: roleRows } = await supabase
            .from("user_roles").select("role").eq("user_id", uid);
          if ((roleRows || []).some((r: any) => r.role === "admin")) {
            navigate("/admin", { replace: true });
            return;
          }
        }
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username || "宠物伙伴" },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("注册成功！请选择身份");
        setStep("role");
      }
    } catch (err: any) {
      toast.error(friendlySupabaseError(err, "操作失败"));
    } finally {
      setLoading(false);
    }
  };

  const pickRole = async (role: typeof ROLE_OPTIONS[number]) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // 普通用户写入 user 角色；其他角色等审核通过后由系统授予，仅记录意向
        if (role.key === "user") {
          await supabase.from("user_roles").insert({ user_id: user.id, role: "user" } as any);
        }
      }
      navigate(role.next);
    } catch (err: any) {
      toast.error(friendlySupabaseError(err, "保存失败"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-3 px-4 h-14">
        <button onClick={() => (step === "role" ? setStep("auth") : navigate(-1))} className="p-1.5 rounded-lg hover:bg-secondary" aria-label="返回">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 max-w-lg mx-auto w-full pb-12">
        <div className="flex items-center gap-2 mb-4 mt-4">
          <PawPrint className="w-10 h-10 text-primary" />
          <span className="font-extrabold text-2xl text-foreground">萌宠到家 · Homey</span>
        </div>

        {step === "auth" && (
          <>
            <p className="text-xs text-muted-foreground text-center leading-relaxed mb-6 px-2">{WELCOME}</p>

            <div className="w-full bg-card rounded-2xl p-6 card-shadow">
              <div className="flex justify-center gap-2 mb-5" role="tablist">
                {(["登录", "注册"] as const).map((t, i) => {
                  const isLog = i === 0;
                  const active = isLog === isLogin;
                  return (
                    <button
                      key={t}
                      onClick={() => setIsLogin(isLog)}
                      className={cn(
                        "px-6 py-1.5 rounded-full text-sm font-bold transition",
                        active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleAuth} className="space-y-3">
                {!isLogin && (
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="昵称" value={username} onChange={(e) => setUsername(e.target.value)} className="pl-10" />
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="email" placeholder="邮箱地址" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-10" />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="password" placeholder="密码（至少6位）" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="pl-10" />
                </div>
                <Button variant="hero" size="xl" className="w-full" type="submit" disabled={loading}>
                  {loading ? "处理中…" : isLogin ? "登录" : "下一步：选择身份"}
                </Button>
              </form>

              {isLogin && (
                <button
                  type="button"
                  onClick={() => setStep("role")}
                  className="block w-full text-center text-xs text-primary mt-4 hover:underline"
                >
                  已登录？前往身份选择 →
                </button>
              )}
            </div>
          </>
        )}

        {step === "role" && (
          <>
            <h2 className="text-xl font-extrabold text-foreground mb-1 text-center">选择你的身份</h2>
            <p className="text-xs text-muted-foreground text-center mb-6">不同身份将看到不同的工作台，可在「我的」中再次切换或申请。</p>

            <div className="grid grid-cols-2 gap-3 w-full">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => pickRole(r)}
                  disabled={loading}
                  className="bg-card rounded-2xl p-4 card-shadow flex flex-col items-center text-center gap-2 hover:scale-[1.02] active:scale-95 transition disabled:opacity-50"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <r.icon className="w-6 h-6 text-primary" />
                  </div>
                  <p className="font-bold text-sm text-foreground">{r.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{r.subtitle}</p>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground text-center mt-6">
              服务人员/商家提交资料后将进入「审核中」状态，通过后自动解锁对应工作台。
            </p>
          </>
        )}
      </main>
    </div>
  );
};

export default AuthPage;
