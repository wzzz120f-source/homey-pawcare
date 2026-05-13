import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PawPrint, Mail, Lock, User, ArrowLeft, Smartphone, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { friendlySupabaseError } from "@/lib/supabaseError";
import { cn } from "@/lib/utils";

type Channel = "phone" | "email";

const PHONE_RE = /^1[3-9]\d{9}$/;

const AuthPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialMode = (params.get("mode") as Channel) || "phone";
  const redirect = params.get("redirect") || "/";

  const [channel, setChannel] = useState<Channel>(initialMode);
  const [emailMode, setEmailMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);

  // email
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  // phone
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    timerRef.current = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [countdown]);

  const goAfterLogin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roleRows } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id);
      const roles = (roleRows || []).map((r: any) => r.role);
      if (roles.includes("admin")) {
        navigate("/admin", { replace: true });
        return;
      }
      // First-login: auto-grant 'user' role so普通用户无需选择身份
      if (roles.length === 0) {
        await supabase.from("user_roles").insert({ user_id: user.id, role: "user" } as any);
      }
    }
    navigate(redirect, { replace: true });
  };

  const sendCode = async () => {
    if (!PHONE_RE.test(phone)) { toast.error("请输入有效手机号"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms-code", { body: { phone } });
      if (error) throw error;
      setCountdown(60);
      const dev = (data as any)?.dev_code;
      if (dev) toast.success(`验证码已发送（演示模式：${dev}）`, { duration: 8000 });
      else toast.success("验证码已发送，请查收短信");
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("rate_limited")) toast.error("请 60 秒后再试");
      else if (msg.includes("daily_limit")) toast.error("当日已达发送上限");
      else toast.error("发送失败，请稍后再试");
    } finally { setLoading(false); }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!PHONE_RE.test(phone)) { toast.error("请输入有效手机号"); return; }
    if (!/^\d{4,8}$/.test(code)) { toast.error("请输入验证码"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-sms-code", { body: { phone, code } });
      if (error) throw error;
      const { access_token, refresh_token } = data as any;
      if (!access_token || !refresh_token) throw new Error("登录失败");
      const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
      if (setErr) throw setErr;
      toast.success("登录成功！");
      await goAfterLogin();
    } catch (err: any) {
      toast.error(err?.message?.includes("wrong_or_expired") ? "验证码错误或已过期" : "登录失败，请重试");
    } finally { setLoading(false); }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (emailMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("登录成功!");
        await goAfterLogin();
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { username: username || "宠物伙伴" }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("注册成功！请前往邮箱验证");
        setEmailMode("login");
      }
    } catch (err: any) {
      toast.error(friendlySupabaseError(err, "操作失败"));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-3 px-4 h-14">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary" aria-label="返回">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 max-w-lg mx-auto w-full pb-12">
        <div className="flex items-center gap-2 mb-2 mt-4">
          <PawPrint className="w-10 h-10 text-primary" />
          <span className="font-extrabold text-2xl text-foreground">萌宠到家 · Homey</span>
        </div>
        <p className="text-xs text-muted-foreground mb-6">让每一份对毛孩子的爱都被温柔以待</p>

        <div className="w-full bg-card rounded-2xl p-6 card-shadow">
          {/* Channel tabs */}
          <div className="flex justify-center gap-1 mb-5 bg-secondary rounded-full p-1" role="tablist">
            {([
              { k: "phone" as const, label: "手机号", icon: Smartphone, hot: true },
              { k: "email" as const, label: "邮箱", icon: Mail },
            ]).map(({ k, label, icon: Icon, hot }) => {
              const active = channel === k;
              return (
                <button
                  key={k}
                  onClick={() => setChannel(k)}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-full text-sm font-bold transition flex items-center justify-center gap-1.5",
                    active ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {hot && !active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">推荐</span>}
                </button>
              );
            })}
          </div>

          {channel === "phone" ? (
            <form onSubmit={handlePhoneLogin} className="space-y-3">
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="tel" inputMode="numeric" maxLength={11}
                  placeholder="手机号" value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  className="pl-10" required
                />
              </div>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text" inputMode="numeric" maxLength={6}
                    placeholder="验证码" value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="pl-10"
                  />
                </div>
                <Button
                  type="button" variant="outline" onClick={sendCode}
                  disabled={loading || countdown > 0 || !PHONE_RE.test(phone)}
                  className="shrink-0"
                >
                  {countdown > 0 ? `${countdown}s` : "获取验证码"}
                </Button>
              </div>
              <Button variant="hero" size="xl" className="w-full" type="submit" disabled={loading}>
                {loading ? "登录中…" : "一键登录 / 注册"}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                未注册手机号将自动创建账号 · 7 天内免重复登录
              </p>
            </form>
          ) : (
            <>
              <div className="flex justify-center gap-2 mb-4" role="tablist">
                {(["登录", "注册"] as const).map((t, i) => {
                  const isLog = i === 0;
                  const active = isLog === (emailMode === "login");
                  return (
                    <button
                      key={t}
                      onClick={() => setEmailMode(isLog ? "login" : "signup")}
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
              <form onSubmit={handleEmailAuth} className="space-y-3">
                {emailMode === "signup" && (
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
                  {loading ? "处理中…" : emailMode === "login" ? "登录" : "注册"}
                </Button>
              </form>
            </>
          )}
        </div>

        <button
          onClick={() => navigate(redirect, { replace: true })}
          className="mt-6 text-xs text-muted-foreground hover:text-foreground"
        >
          以游客身份继续浏览 →
        </button>
      </main>
    </div>
  );
};

export default AuthPage;
