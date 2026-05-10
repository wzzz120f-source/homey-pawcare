import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** 标题，例如「批量打款」「审核退款」 */
  actionLabel: string;
  /** 风险描述 */
  description?: string;
  /** 通过密码再校验后回调 */
  onConfirmed: () => void | Promise<void>;
}

/**
 * 管理员高危操作二次确认弹窗。
 * 流程：输入登录密码 → 调用 signInWithPassword 验证 → 调用 admin-confirm-auth 写入 5 分钟有效窗口 → 触发 onConfirmed。
 */
const AdminConfirmDialog = ({ open, onOpenChange, actionLabel, description, onConfirmed }: Props) => {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!user?.email) { setErr("当前账号缺少邮箱，无法二次校验"); return; }
    if (password.length < 6) { setErr("请输入登录密码"); return; }
    setLoading(true); setErr(null);
    try {
      // 重新校验密码（使用 signInWithPassword 会刷新 session，但同账号 token 仍有效）
      const { error: pErr } = await supabase.auth.signInWithPassword({
        email: user.email, password,
      });
      if (pErr) { setErr("密码错误"); setLoading(false); return; }

      const { error: aErr } = await supabase.functions.invoke("admin-confirm-auth");
      if (aErr) { setErr("校验失败：" + aErr.message); setLoading(false); return; }

      setPassword("");
      onOpenChange(false);
      await onConfirmed();
    } catch (e: any) {
      setErr(e?.message || "校验失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!loading) onOpenChange(o); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            高危操作 · 二次确认
          </DialogTitle>
          <DialogDescription>
            即将执行：<span className="font-semibold text-foreground">{actionLabel}</span>
          </DialogDescription>
        </DialogHeader>

        {description && (
          <Alert variant="destructive">
            <AlertDescription>{description}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="admin-pwd">请输入您的登录密码</Label>
          <Input
            id="admin-pwd"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {err && <p className="text-xs text-destructive">{err}</p>}
          <p className="text-xs text-muted-foreground">校验通过后 5 分钟内可继续执行同类操作。</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>取消</Button>
          <Button onClick={submit} disabled={loading || !password}>
            {loading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            确认执行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminConfirmDialog;
