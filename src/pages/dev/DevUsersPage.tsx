import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Loader2, Search, Ban, ShieldCheck, KeyRound, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface DevUser {
  user_id: string; username: string | null; avatar_url: string | null;
  love_points: number; is_banned: boolean; is_super_admin: boolean;
  banned_reason: string | null; roles: string[]; created_at: string;
}

const ALL_ROLES = ["admin", "merchant", "sitter", "groomer", "driver"];

const DevUsersPage = () => {
  const [users, setUsers] = useState<DevUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.rpc("dev_list_users", { _search: search || null, _limit: 100, _offset: 0 });
    setUsers((data as DevUser[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const ban = async (u: DevUser) => {
    const reason = u.is_banned ? null : prompt("封禁原因？") || "违规";
    if (!u.is_banned && reason === null) return;
    const { data, error } = await supabase.rpc("dev_set_ban", { _user_id: u.user_id, _ban: !u.is_banned, _reason: reason });
    if (error || !(data as any)?.success) return toast.error("操作失败");
    toast.success(u.is_banned ? "已解封" : "已封禁");
    load();
  };

  const resetPw = async (u: DevUser) => {
    const email = prompt(`输入 ${u.username || u.user_id} 的邮箱以发送重置链接：`);
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) toast.error(error.message);
    else toast.success("重置邮件已发送");
  };

  const setRole = async (u: DevUser, role: string, grant: boolean) => {
    const { data, error } = await supabase.rpc("dev_set_role", { _user_id: u.user_id, _role: role as any, _grant: grant });
    if (error || !(data as any)?.success) return toast.error("操作失败");
    toast.success(grant ? `已授予 ${role}` : `已撤销 ${role}`);
    load();
  };

  const toggleSuper = async (u: DevUser) => {
    if (!confirm(`${u.is_super_admin ? "撤销" : "授予"}超级管理员？`)) return;
    const { data, error } = await supabase.rpc("dev_set_super_admin", { _user_id: u.user_id, _value: !u.is_super_admin });
    if (error || !(data as any)?.success) return toast.error("操作失败");
    toast.success("已更新");
    load();
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate("/__dev/console")} aria-label="返回" className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-lg font-semibold flex items-center gap-2"><Users className="w-5 h-5 text-primary" />用户管理</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        <Card className="p-3 flex gap-2">
          <Input placeholder="搜索用户名或 user_id" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          <Button onClick={load}><Search className="w-4 h-4" /></Button>
        </Card>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : users.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">无结果</p>
        ) : users.map((u) => (
          <Card key={u.user_id} className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold truncate">{u.username || "未命名"}</span>
                  {u.is_super_admin && <Badge variant="default" className="text-[10px]">超管</Badge>}
                  {u.is_banned && <Badge variant="destructive" className="text-[10px]">已封禁</Badge>}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono truncate">{u.user_id}</div>
                <div className="text-xs mt-1 flex flex-wrap gap-1">
                  {u.roles.length === 0 ? <span className="text-muted-foreground">无角色</span> :
                    u.roles.map((r) => (
                      <Badge key={r} variant="secondary" className="text-[10px] gap-1">
                        {r}
                        <button onClick={() => setRole(u, r, false)} aria-label={`撤销 ${r}`}><X className="w-3 h-3" /></button>
                      </Badge>
                    ))}
                </div>
                {u.banned_reason && <div className="text-xs text-destructive mt-1">原因：{u.banned_reason}</div>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={u.is_banned ? "outline" : "destructive"} onClick={() => ban(u)}>
                <Ban className="w-3.5 h-3.5 mr-1" />{u.is_banned ? "解封" : "封禁"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => resetPw(u)}>
                <KeyRound className="w-3.5 h-3.5 mr-1" />重置密码
              </Button>
              <Button size="sm" variant="outline" onClick={() => toggleSuper(u)}>
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />{u.is_super_admin ? "撤销超管" : "设为超管"}
              </Button>
              <select
                className="text-xs border rounded px-2 h-9 bg-background"
                onChange={(e) => { if (e.target.value) { setRole(u, e.target.value, true); e.target.value = ""; } }}
                defaultValue=""
              >
                <option value="" disabled>授予角色…</option>
                {ALL_ROLES.filter((r) => !u.roles.includes(r)).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </Card>
        ))}
      </main>
    </div>
  );
};

export default DevUsersPage;
