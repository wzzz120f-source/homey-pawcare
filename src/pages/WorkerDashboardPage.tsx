import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ClipboardList,
  MapPin,
  Wallet,
  GraduationCap,
  ArrowLeft,
  Sparkles,
  Stethoscope,
  CalendarClock,
  Navigation as NavIcon,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CompanionReportGenerator from "@/components/CompanionReportGenerator";
import HealthAssessmentForm, { GroomerLevel } from "@/components/HealthAssessmentForm";
import RoleSwitcher from "@/components/RoleSwitcher";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useGroomerLevel } from "@/hooks/useGroomerLevel";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WorkerOrder {
  id: string;
  order_no: string;
  service_type: string | null;
  order_status: string;
  total_amount: number;
  pickup_address: string | null;
  dropoff_address: string | null;
  booking_date: string | null;
  booking_time: string | null;
  driver_fare: number | null;
}

const LEVEL_OPTIONS: { value: GroomerLevel; label: string }[] = [
  { value: "junior", label: "初级" },
  { value: "intermediate", label: "中级" },
  { value: "senior", label: "高级" },
  { value: "expert", label: "资深" },
];

const WorkerDashboardPage = () => {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") ?? "overview";
  const { user } = useAuth();
  const { activeRole } = useUserRoles();
  const { toast } = useToast();
  const isGroomer = activeRole === "groomer";
  const isDriver = activeRole === "driver";
  const isSitter = activeRole === "sitter";
  const { level: groomerLevel, setLevel: setGroomerLevel, loading: levelLoading } = useGroomerLevel();

  const [orders, setOrders] = useState<WorkerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) {
        setOrders([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const today = new Date().toISOString().slice(0, 10);
      // 司机：通过 driver_id；其它工作者：暂以 driver_id 关联（项目当前未区分 worker_id）
      let q = supabase
        .from("orders")
        .select("id, order_no, service_type, order_status, total_amount, pickup_address, dropoff_address, booking_date, booking_time, driver_fare")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      // 当日相关：今日及未来
      if (tab === "schedule") q = q.gte("booking_date", today);
      const { data, error } = await q;
      if (cancelled) return;
      if (!error && data) setOrders(data as WorkerOrder[]);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user, tab]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todays = orders.filter((o) => (o.booking_date ?? "").slice(0, 10) === today);
    const pending = orders.filter((o) => o.order_status === "confirmed").length;
    const inProg = orders.filter((o) => o.order_status === "in_progress").length;
    const done = todays.filter((o) => o.order_status === "completed").length;
    const incomeToday = todays
      .filter((o) => o.order_status === "completed")
      .reduce((s, o) => s + Number(o.driver_fare ?? o.total_amount ?? 0), 0);
    return { pending, inProg, done, incomeToday };
  }, [orders]);

  const activeTrip = orders.find((o) => o.order_status === "in_progress");

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
        {/* 收入 + 状态卡（每个 Tab 都展示） */}
        <section className="rounded-2xl p-5 card-shadow bg-gradient-to-br from-primary/15 to-accent/15">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">今日预计收入</p>
              <p className="text-3xl font-extrabold text-primary mt-1 tabular-nums">
                ¥ {stats.incomeToday.toFixed(2)}
              </p>
            </div>
            <Wallet className="w-10 h-10 text-primary/60" />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div><p className="text-[11px] text-muted-foreground">待接单</p><p className="font-bold tabular-nums">{stats.pending}</p></div>
            <div><p className="text-[11px] text-muted-foreground">进行中</p><p className="font-bold tabular-nums">{stats.inProg}</p></div>
            <div><p className="text-[11px] text-muted-foreground">已完成</p><p className="font-bold tabular-nums">{stats.done}</p></div>
          </div>
        </section>

        {/* 司机：当前进行中行程快捷入口 */}
        {isDriver && activeTrip && (
          <section className="rounded-2xl p-4 card-shadow bg-card border-2 border-primary/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <NavIcon className="w-5 h-5 text-primary" />
                <h2 className="font-bold">继续行程</h2>
              </div>
              <Badge className="bg-primary text-primary-foreground">进行中</Badge>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">单号 {activeTrip.order_no}</p>
            <Button variant="hero" size="sm" className="mt-3 w-full" onClick={() => navigate(`/track/${activeTrip.id}`)}>
              进入实时追踪
            </Button>
          </section>
        )}

        {/* Tab 视图 */}
        {tab === "overview" && (
          <section className="rounded-2xl p-4 card-shadow bg-card">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="w-5 h-5 text-primary" />
              <h2 className="font-bold">今日待办</h2>
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-6">加载中…</p>
            ) : orders.filter((o) => ["confirmed", "in_progress"].includes(o.order_status)).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">暂无待办，等待平台派单中…</p>
            ) : (
              <ul className="space-y-2">
                {orders
                  .filter((o) => ["confirmed", "in_progress"].includes(o.order_status))
                  .slice(0, 8)
                  .map((o) => (
                    <li key={o.id} className="flex items-center justify-between rounded-xl border bg-background p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{o.service_type || "服务"} · {o.order_no}</p>
                        <p className="text-xs text-muted-foreground truncate">{o.pickup_address || "—"}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/order/${o.id}`)}>查看</Button>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        )}

        {tab === "schedule" && (
          <section className="rounded-2xl p-4 card-shadow bg-card">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="w-5 h-5 text-primary" />
              <h2 className="font-bold">未来排班</h2>
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-6">加载中…</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">暂无即将开始的预约</p>
            ) : (
              <ul className="space-y-2">
                {orders.slice(0, 12).map((o) => (
                  <li key={o.id} className="rounded-xl border bg-background p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold tabular-nums">{o.booking_date || "—"} {o.booking_time || ""}</p>
                      <Badge variant="secondary">{o.service_type || "服务"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{o.pickup_address || "—"}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "route" && isDriver && (
          <section className="rounded-2xl p-4 card-shadow bg-card">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5 text-primary" />
              <h2 className="font-bold">附近接送任务</h2>
            </div>
            <div className="bg-muted/40 rounded-xl h-40 flex items-center justify-center text-sm text-muted-foreground">
              地图加载中… 实时任务将在此显示
            </div>
          </section>
        )}

        {tab === "services" && isGroomer && (
          <section className="rounded-2xl p-4 card-shadow bg-card space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-primary" />
                <h2 className="font-bold">健康评估 & AI 建议</h2>
              </div>
              <Badge variant="secondary" className="text-[11px]">当前等级 · {LEVEL_OPTIONS.find(o => o.value === groomerLevel)?.label}</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {LEVEL_OPTIONS.map((o) => (
                <Button
                  key={o.value}
                  size="sm"
                  variant={groomerLevel === o.value ? "default" : "outline"}
                  className="h-7 px-2.5 text-xs"
                  disabled={levelLoading}
                  onClick={async () => {
                    const { error } = await setGroomerLevel(o.value);
                    if (error) toast({ title: "等级保存失败", description: error, variant: "destructive" });
                    else toast({ title: "等级已更新", description: `已切换为${o.label}护理师` });
                  }}
                >
                  {o.label}
                </Button>
              ))}
            </div>
            <HealthAssessmentForm level={groomerLevel} petName="毛球" />
          </section>
        )}

        {tab === "training" && (
          <section className="rounded-2xl p-4 card-shadow bg-card">
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              <h2 className="font-bold">培训中心</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-3">完成基础课程可解锁高单价订单</p>
            <Button variant="hero" size="sm" onClick={() => navigate("/driver/apply")}>查看课程</Button>
          </section>
        )}

        {/* 默认 overview 才显示陪伴日记入口（sitter 高频） */}
        {tab === "overview" && (isSitter || isGroomer) && (
          <section className="rounded-2xl p-4 card-shadow bg-card">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="font-bold">陪伴日记 & 海报</h2>
            </div>
            <CompanionReportGenerator petName="毛球" sitterName="守护者" />
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default WorkerDashboardPage;
