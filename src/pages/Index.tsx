import { useNavigate } from "react-router-dom";
import { PawPrint, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ServiceCard from "@/components/ServiceCard";
import TechnicianCard from "@/components/TechnicianCard";
import BottomNav from "@/components/BottomNav";
import { useServices, useTechnicians } from "@/hooks/useHomeData";

import heroBanner from "@/assets/hero-banner.jpg";

const Index = () => {
  const navigate = useNavigate();
  const { data: services, isLoading: loadingServices } = useServices();
  const { data: technicians, isLoading: loadingTechnicians } = useTechnicians();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center justify-between px-5 h-14 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <PawPrint className="w-6 h-6 text-primary" aria-hidden="true" />
            <span className="font-extrabold text-lg text-foreground">萌宠到家</span>
          </div>
          <span className="text-sm text-muted-foreground" aria-label="当前定位">📍 上海市浦东新区</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto">
        {/* Hero */}
        <section className="relative mx-4 mt-4 rounded-2xl overflow-hidden animate-fade-in-up" aria-label="欢迎横幅">
          <img
            src={heroBanner}
            alt="宠物服务"
            className="w-full h-48 object-cover"
            loading="eager"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" aria-hidden="true" />
          <div className="absolute bottom-4 left-4 right-4">
            <h1 className="text-2xl font-extrabold text-primary-foreground mb-1">
              专业宠物上门服务
            </h1>
            <p className="text-sm text-primary-foreground/80">让毛孩子在家也能享受五星护理 ✨</p>
          </div>
        </section>

        {/* CTA */}
        <div className="px-4 mt-5 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <Button
            variant="hero"
            size="xl"
            className="w-full gap-2"
            onClick={() => navigate("/booking")}
          >
            <Sparkles className="w-5 h-5" aria-hidden="true" />
            立即预约上门服务
          </Button>
        </div>

        {/* Popular Services */}
        <section className="mt-8 animate-fade-in-up" style={{ animationDelay: "0.2s" }} aria-label="热门服务">
          <div className="flex items-center justify-between px-5 mb-3">
            <h2 className="text-lg font-extrabold text-foreground">🔥 热门服务</h2>
            <button
              type="button"
              className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-primary transition-colors min-h-[44px] min-w-[44px] justify-end"
              aria-label="查看全部服务"
            >
              查看全部 <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <div
            className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-none -webkit-overflow-scrolling-touch"
            role="list"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {loadingServices
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="flex-shrink-0 w-40 h-[180px] rounded-2xl" />
                ))
              : services?.map((s) => (
                  <ServiceCard key={s.id} {...s} onClick={() => navigate("/booking")} />
                ))}
          </div>
        </section>

        {/* Top Technicians */}
        <section className="mt-8 px-5 animate-fade-in-up" style={{ animationDelay: "0.3s" }} aria-label="附近高分技师">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-extrabold text-foreground">⭐ 附近高分技师</h2>
            <button
              type="button"
              className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-primary transition-colors min-h-[44px] min-w-[44px] justify-end"
              aria-label="查看更多技师"
            >
              更多 <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-col gap-3" role="list">
            {loadingTechnicians
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[76px] rounded-2xl" />
                ))
              : technicians?.map((t) => (
                  <TechnicianCard key={t.id} {...t} />
                ))}
          </div>
        </section>

        {/* Quick Actions */}
        <section className="mt-8 px-5 pb-6 animate-fade-in-up" style={{ animationDelay: "0.4s" }} aria-label="快捷入口">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="warm" size="lg" className="h-auto py-4 flex-col gap-1" onClick={() => navigate("/booking")}>
              <span className="text-2xl" aria-hidden="true">🏠</span>
              <span className="font-bold">宠物寄养</span>
              <span className="text-xs text-muted-foreground">附近优质门店</span>
            </Button>
            <Button variant="warm" size="lg" className="h-auto py-4 flex-col gap-1" onClick={() => navigate("/booking")}>
              <span className="text-2xl" aria-hidden="true">🚗</span>
              <span className="font-bold">宠物接送</span>
              <span className="text-xs text-muted-foreground">安全专车服务</span>
            </Button>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
