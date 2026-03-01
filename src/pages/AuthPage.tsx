import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PawPrint, Mail, Lock, User, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const AuthPage = () => {
  const navigate = useNavigate();
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
        toast.success("登录成功！");
        navigate("/community");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username || "宠物主人" },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("注册成功！请查看邮箱确认。");
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
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 max-w-lg mx-auto w-full">
        <div className="flex items-center gap-2 mb-8">
          <PawPrint className="w-10 h-10 text-primary" />
          <span className="font-extrabold text-2xl text-foreground">萌宠到家</span>
        </div>

        <div className="w-full bg-card rounded-2xl p-6 card-shadow">
          <h2 className="text-xl font-extrabold text-foreground mb-6 text-center">
            {isLogin ? "欢迎回来 👋" : "创建账号 🎉"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="昵称"
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
                placeholder="密码（至少6位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="pl-10"
              />
            </div>
            <Button variant="hero" size="xl" className="w-full" type="submit" disabled={loading}>
              {loading ? "处理中..." : isLogin ? "登录" : "注册"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-4">
            {isLogin ? "还没有账号？" : "已有账号？"}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary font-bold ml-1 hover:underline"
            >
              {isLogin ? "立即注册" : "去登录"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
};

export default AuthPage;
