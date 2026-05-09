import { useNavigate } from "react-router-dom";
import { ClipboardList, MapPin, Wallet, GraduationCap, ArrowLeft, Sparkles, Stethoscope } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import CompanionReportGenerator from "@/components/CompanionReportGenerator";
import HealthAssessmentForm, { GroomerLevel } from "@/components/HealthAssessmentForm";
import RoleSwitcher from "@/components/RoleSwitcher";
import { useUserRoles } from "@/hooks/useUserRoles";

const WorkerDashboardPage = () => {
  const navigate = useNavigate();
  const { activeRole } = useUserRoles();
  const isGroomer = activeRole === "groomer";
  // 暂以中级为默认，未来可根据 user_roles.level 字段读取
  const groomerLevel: GroomerLevel = "intermediate";
  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary" aria-label="返回">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-extrabold text-foreground flex-1">工作台</h1>
        <RoleSwitcher />
      </header>

      <main className="px-4 py-4 max-w-lg mx-auto space-y-4">
        <section className="rounded-2xl p-5 card-shadow bg-gradient-to-br from-primary/15 to-accent/15">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">今日预计收入</p>
              <p className="text-3xl font-extrabold text-primary mt-1">¥ 0.00</p>
            </div>
            <Wallet className="w-10 h-10 text-primary/60" />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div><p className="text-[11px] text-muted-foreground">待接单</p><p className="font-bold">0</p></div>
            <div><p className="text-[11px] text-muted-foreground">进行中</p><p className="font-bold">0</p></div>
            <div><p className="text-[11px] text-muted-foreground">已完成</p><p className="font-bold">0</p></div>
          </div>
        </section>

        <section className="rounded-2xl p-4 card-shadow bg-card">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-5 h-5 text-primary" />
            <h2 className="font-bold">今日待办</h2>
          </div>
          <p className="text-sm text-muted-foreground text-center py-6">暂无待办，等待平台派单中…</p>
        </section>

        <section className="rounded-2xl p-4 card-shadow bg-card">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-5 h-5 text-primary" />
            <h2 className="font-bold">附近订单</h2>
          </div>
          <div className="bg-muted/40 rounded-xl h-40 flex items-center justify-center text-sm text-muted-foreground">
            地图加载中…
          </div>
        </section>

        <section className="rounded-2xl p-4 card-shadow bg-card">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-bold">陪伴日记 & 海报</h2>
          </div>
          <CompanionReportGenerator petName="毛球" sitterName="守护者" />
        </section>

        {isGroomer && (
          <section className="rounded-2xl p-4 card-shadow bg-card">
            <div className="flex items-center gap-2 mb-3">
              <Stethoscope className="w-5 h-5 text-primary" />
              <h2 className="font-bold">健康评估 & AI 建议</h2>
            </div>
            <HealthAssessmentForm level={groomerLevel} petName="毛球" />
          </section>
        )}

        <section className="rounded-2xl p-4 card-shadow bg-card">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <h2 className="font-bold">培训中心</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">完成基础课程可解锁高单价订单</p>
          <Button variant="hero" size="sm" onClick={() => navigate("/driver/apply")}>查看课程</Button>
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default WorkerDashboardPage;
