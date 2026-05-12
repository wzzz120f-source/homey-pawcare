import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isSuperAdminEmail } from "@/config/superAdmins";
import { refreshSuperAdmin } from "@/hooks/useSuperAdmin";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const SuperAdminLoginDialog = ({ open, onOpenChange }: Props) => {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;
      const uid = data.user?.id;
      if (!uid) throw new Error("登录失败");

      // 验证超管身份
      const { data: prof } = await supabase
        .from("profiles")
        .select("is_super_admin")
        .eq("user_id", uid)
        .maybeSingle();

      const isSuper = !!prof?.is_super_admin || isSuperAdminEmail(data.user?.email);
      if (!isSuper) {
        await supabase.auth.signOut();
        toast.error("非特权账号，已自动登出");
        return;
      }
      sessionStorage.setItem("dev_console_unlocked", "1");
      refreshSuperAdmin();
      toast.success("欢迎，超级管理员");
      onOpenChange(false);
      navigate("/__dev/console");
    } catch (err: any) {
      toast.error(err?.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> 开发者特权登录
          </DialogTitle>
          <DialogDescription>仅授权超级管理员可进入开发者后台。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleLogin} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="dev-email">邮箱</Label>
            <Input id="dev-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dev-pw">密码</Label>
            <Input id="dev-pw" type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "登录并进入"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SuperAdminLoginDialog;
