import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PawPrint, Mail, Lock, User, ArrowLeft, Briefcase, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Role = "user" | "provider";

const AuthPage = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("user");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("登录成功!");
        // 服务商登录后直奔申请/中心页
        navigate(role === "provider" ? "/driver/apply" : "/community");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username || (role === "provider" ? "宠托师" : "宠物主人") },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success(role === "provider" ? "注册成功!请查收邮件,然后开始入驻申请。" : "注册成功!请查看邮箱确认。");
      }
    } catch (error: any) {
      toast.error(error.message || "操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-3 px-4 h-14">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" aria-label="返回">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 max-w-lg mx-auto w-full">
        <div className="flex items-center gap-2 mb-6">
          <PawPrint className="w-10 h-10 text-primary" />
          <span className="font-extrabold text-2xl text-foreground">萌宠到家</span>
        </div>

        {/* 身份切换 Toggle */}
        <div className="w-full grid grid-cols-2 gap-2 p-1 bg-secondary rounded-2xl mb-5" role="tablist" aria-label="身份选择">
          {([
            { key: "user" as const, label: "用户登录", icon: UserCircle2, hint: "预约服务" },
            { key: "provider" as const, label: "服务商登录", icon: Briefcase, hint: "宠托师/商家" },
          ]).map((r) => {
            const active = role === r.key;
            return (
              <button
                key={r.key}
                role="tab"
                aria-selected={active}
                onClick={() => setRole(r.key)}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2.5 rounded-xl transition-all",
                  active ? "bg-card card-shadow text-primary" : "text-muted-foreground",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <r.icon className="w-4 h-4" />
                  <span className="text-sm font-bold">{r.label}</span>
                </div>
                <span className="text-[10px] opacity-80">{r.hint}</span>
              </button>
            );
          })}
        </div>

        <div className="w-full bg-card rounded-2xl p-6 card-shadow">
          <h2 className="text-xl font-extrabold text-foreground mb-1 text-center">
            {isLogin ? "欢迎回来 👋" : role === "provider" ? "成为宠托师 🚀" : "创建账号 🎉"}
          </h2>
          <p className="text-xs text-muted-foreground text-center mb-5">
            {role === "provider"
              ? isLogin
                ? "登录后进入入驻申请/接单中心"
                : "注册即可开始资料审核与认证测试"
              : "登录后即可预约上门服务、参与社区"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={role === "provider" ? "您的真实姓名" : "昵称"}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="密码(至少6位)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="pl-10"
              />
            </div>
            <Button variant="hero" size="xl" className="w-full" type="submit" disabled={loading}>
              {loading ? "处理中..." : isLogin ? "登录" : role === "provider" ? "注册并开始入驻" : "注册"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-4">
            {isLogin ? "还没有账号?" : "已有账号?"}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary font-bold ml-1 hover:underline"
            >
              {isLogin ? "立即注册" : "去登录"}
            </button>
          </p>

          {role === "provider" && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <button
                type="button"
                onClick={() => navigate("/driver/apply")}
                className="w-full text-xs text-primary hover:underline"
              >
                了解宠托师权益与入驻流程 →
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AuthPage;
