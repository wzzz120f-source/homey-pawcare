import { useNavigate } from "react-router-dom";
import { PawPrint, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import ServiceCard from "@/components/ServiceCard";
import TechnicianCard from "@/components/TechnicianCard";
import BottomNav from "@/components/BottomNav";

import heroBanner from "@/assets/hero-banner.jpg";
import serviceBath from "@/assets/service-bath.jpg";
import serviceGrooming from "@/assets/service-grooming.jpg";
import serviceHealth from "@/assets/service-health.jpg";
import serviceWalking from "@/assets/service-walking.jpg";

const services = [
  { image: serviceBath, title: "宠物洗澡 SPA", price: "¥89起", rating: 4.9 },
  { image: serviceGrooming, title: "精致美容造型", price: "¥128起", rating: 4.8 },
  { image: serviceHealth, title: "上门健康检查", price: "¥168起", rating: 4.9 },
  { image: serviceWalking, title: "专业遛狗陪伴", price: "¥58起", rating: 4.7 },
];

const technicians = [
  { name: "李小萌", avatar: serviceBath, specialty: "猫咪美容 · 8年经验", rating: 4.9, reviews: 326, distance: "1.2km" },
  { name: "王大鹏", avatar: serviceGrooming, specialty: "大型犬护理 · 6年经验", rating: 4.8, reviews: 218, distance: "2.5km" },
  { name: "张美丽", avatar: serviceHealth, specialty: "宠物健康师 · 10年经验", rating: 5.0, reviews: 502, distance: "0.8km" },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center justify-between px-5 h-14 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <PawPrint className="w-6 h-6 text-primary" />
            <span className="font-extrabold text-lg text-foreground">萌宠到家</span>
          </div>
          <span className="text-sm text-muted-foreground">📍 上海市浦东新区</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto">
        {/* Hero */}
        <section className="relative mx-4 mt-4 rounded-2xl overflow-hidden animate-fade-in-up">
          <img src={heroBanner} alt="宠物服务" className="w-full h-48 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
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
            <Sparkles className="w-5 h-5" />
            立即预约上门服务
          </Button>
        </div>

        {/* Popular Services */}
        <section className="mt-8 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center justify-between px-5 mb-3">
            <h2 className="text-lg font-extrabold text-foreground">🔥 热门服务</h2>
            <button className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-primary transition-colors">
              查看全部 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-none">
            {services.map((s, i) => (
              <ServiceCard key={i} {...s} onClick={() => navigate("/booking")} />
            ))}
          </div>
        </section>

        {/* Top Technicians */}
        <section className="mt-8 px-5 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-extrabold text-foreground">⭐ 附近高分技师</h2>
            <button className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-primary transition-colors">
              更多 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {technicians.map((t, i) => (
              <TechnicianCard key={i} {...t} />
            ))}
          </div>
        </section>

        {/* Quick Actions */}
        <section className="mt-8 px-5 pb-6 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="warm" size="lg" className="h-auto py-4 flex-col gap-1" onClick={() => navigate("/booking")}>
              <span className="text-2xl">🏠</span>
              <span className="font-bold">宠物寄养</span>
              <span className="text-xs text-muted-foreground">附近优质门店</span>
            </Button>
            <Button variant="warm" size="lg" className="h-auto py-4 flex-col gap-1" onClick={() => navigate("/booking")}>
              <span className="text-2xl">🚗</span>
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
