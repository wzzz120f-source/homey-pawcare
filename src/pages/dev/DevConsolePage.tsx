import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, ToggleRight, Activity, ScrollText, ShieldCheck, ClipboardList, Banknote, Percent, BarChart3, LogOut } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUserRoles, type ActiveRole } from "@/hooks/useUserRoles";
import { supabase } from "@/integrations/supabase/client";
import { refreshSuperAdmin } from "@/hooks/useSuperAdmin";
import { toast } from "sonner";

const ROLE_HOMES: Record<ActiveRole, string> = {
  user: "/", sitter: "/worker", groomer: "/worker", driver: "/worker", merchant: "/merchant", admin: "/admin",
};
const ROLE_LABEL: Record<ActiveRole, string> = {
  user: "铲屎官", sitter: "宠托师", groomer: "护理师", driver: "司机", merchant: "商家", admin: "审核员",
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
    <div className="grid grid-cols-2 gap-3">{children}</div>
  </div>
);

const Tile = ({ to, icon: Icon, label, desc }: any) => (
  <Link to={to}>
    <Card className="p-4 hover:bg-muted/50 transition cursor-pointer h-full">
      <Icon className="w-6 h-6 text-primary mb-2" />
      <div className="font-semibold text-sm">{label}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
    </Card>
  </Link>
);

const DevConsolePage = () => {
  const navigate = useNavigate();
  const { setActiveRole } = useUserRoles();

  const switchTo = (r: ActiveRole) => {
    setActiveRole(r === "user" ? null : r);
    navigate(ROLE_HOMES[r]);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem("dev_console_unlocked");
    refreshSuperAdmin();
    toast.success("已登出");
    navigate("/");
  };

  const allRoles: ActiveRole[] = ["user", "sitter", "groomer", "driver", "merchant", "admin"];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate("/")} aria-label="返回" className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-lg font-semibold flex-1 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> 开发者控制台
          </h1>
          <Button variant="ghost" size="sm" onClick={logout}><LogOut className="w-4 h-4 mr-1" />登出</Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-6">
        <Section title="角色模拟（一键预览任一界面）">
          {allRoles.map((r) => (
            <Card key={r} className="p-3 hover:bg-muted/50 transition cursor-pointer" onClick={() => switchTo(r)}>
              <div className="text-sm font-semibold">{ROLE_LABEL[r]}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">跳转 {ROLE_HOMES[r]}</div>
            </Card>
          ))}
        </Section>

        <Section title="开发者专属">
          <Tile to="/__dev/users" icon={Users} label="用户管理" desc="搜索/封禁/改资料/角色" />
          <Tile to="/__dev/flags" icon={ToggleRight} label="功能开关" desc="维护模式/灰度" />
          <Tile to="/__dev/health" icon={Activity} label="系统健康" desc="DB/支付/审核" />
        </Section>

        <Section title="管理端模块">
          <Tile to="/admin" icon={ShieldCheck} label="管理总览" desc="收益/订单/用户" />
          <Tile to="/admin/applications" icon={ClipboardList} label="注册审核" desc="商家/服务者/救助/KYC" />
          <Tile to="/admin/commission" icon={Percent} label="抽成设置" desc="按角色配置" />
          <Tile to="/admin/revenue" icon={BarChart3} label="收益看板" desc="平台收入" />
          <Tile to="/admin/withdrawals" icon={Banknote} label="提现审核" desc="风控与放款" />
          <Tile to="/admin/audit" icon={ScrollText} label="审计日志" desc="超管操作留痕" />
        </Section>
      </main>
    </div>
  );
};

export default DevConsolePage;
