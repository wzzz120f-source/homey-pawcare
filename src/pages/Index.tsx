import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PawPrint, ChevronRight, Sparkles, Package, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import ServiceCard from "@/components/ServiceCard";
import TechnicianCard from "@/components/TechnicianCard";
import BottomNav from "@/components/BottomNav";
import NotificationBell from "@/components/NotificationBell";
import LostPetAlert from "@/components/LostPetAlert";
import { useServices, useTechnicians } from "@/hooks/useHomeData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

import heroBanner from "@/assets/hero-banner.jpg";

interface RecentOrder {
  id: string;
  order_no: string;
  service_type: string | null;
  order_status: string;
  total_amount: number;
  created_at: string;
}

interface RecommendedProduct {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  sales_count: number;
  category_id: string | null;
  cover_image: string | null;
}

const CATEGORY_EMOJI: Record<string, string> = {
  "c1111111-1111-1111-1111-111111111111": "🐱",
  "c2222222-2222-2222-2222-222222222222": "🐶",
  "c3333333-3333-3333-3333-333333333333": "🧸",
  "c4444444-4444-4444-4444-444444444444": "👕",
  "c5555555-5555-5555-5555-555555555555": "💊",
};
const getEmoji = (id: string | null) => (id && CATEGORY_EMOJI[id]) || "🏠";

const STATUS_LABEL: Record<string, string> = {
  created: "待支付",
  confirmed: "已确认",
  in_progress: "进行中",
  completed: "已完成",
};

/* ── Skeleton Placeholders ── */
const ServiceSkeleton = () => (
  <div className="flex-shrink-0 w-40 space-y-2">
    <Skeleton className="w-40 h-28 rounded-2xl" />
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-3 w-16" />
  </div>
);

const ProductSkeleton = () => (
  <div className="shrink-0 w-36 space-y-2">
    <Skeleton className="aspect-square w-36 rounded-t-xl" />
    <div className="px-1 space-y-1.5">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-3 w-12" />
    </div>
  </div>
);

const TechnicianSkeleton = () => <Skeleton className="h-[76px] rounded-2xl" />;

const OrderSkeleton = () => (
  <Card>
    <CardContent className="p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="space-y-1.5 flex flex-col items-end">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-14 rounded-full" />
      </div>
    </CardContent>
  </Card>
);

const Index = () => {
  const navigate = useNavigate();
  const { data: services, isLoading: loadingServices } = useServices();
  const { data: technicians, isLoading: loadingTechnicians } = useTechnicians();
  const { user } = useAuth();
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recommended, setRecommended] = useState<RecommendedProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    supabase
      .from("products")
      .select("id, name, price, original_price, sales_count, category_id, cover_image")
      .order("sales_count", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (data) setRecommended(data as any);
        setLoadingProducts(false);
      });
  }, []);

  useEffect(() => {
    if (!user) { setRecentOrders([]); return; }
    setLoadingOrders(true);
    supabase
      .from("orders")
      .select("id, order_no, service_type, order_status, total_amount, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (data) setRecentOrders(data as RecentOrder[]);
        setLoadingOrders(false);
      });
  }, [user]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center justify-between px-5 h-14 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <PawPrint className="w-6 h-6 text-primary" aria-hidden="true" />
            <span className="font-extrabold text-lg text-foreground">萌宠到家</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <span className="text-sm text-muted-foreground" aria-label="当前定位">📍 上海市浦东新区</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto">
        {/* Hero */}
        <section className="relative mx-4 mt-4 rounded-2xl overflow-hidden animate-fade-in-up" aria-label="欢迎横幅">
          <img src={heroBanner} alt="宠物服务" className="w-full h-48 object-cover" loading="eager" fetchPriority="high" />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" aria-hidden="true" />
          <div className="absolute bottom-4 left-4 right-4">
            <h1 className="text-2xl font-extrabold text-primary-foreground mb-1">专业宠物上门服务</h1>
            <p className="text-sm text-primary-foreground/80">让毛孩子在家也能享受五星护理 ✨</p>
          </div>
        </section>


        {/* CTA */}
        <div className="px-4 mt-5 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <Button variant="hero" size="xl" className="w-full gap-2" onClick={() => navigate("/booking")}>
            <Sparkles className="w-5 h-5" aria-hidden="true" />
            立即预约上门服务
          </Button>
        </div>

        {/* Recent Orders */}
        {(loadingOrders || recentOrders.length > 0) && (
          <section className="mt-6 px-5 animate-fade-in-up" style={{ animationDelay: "0.15s" }} aria-label="最近订单">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-extrabold text-foreground">📦 最近订单</h2>
              <button type="button" className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-primary transition-colors min-h-[44px] min-w-[44px] justify-end" onClick={() => navigate("/profile")}>
                全部 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {loadingOrders
                ? Array.from({ length: 2 }).map((_, i) => <OrderSkeleton key={i} />)
                : recentOrders.map((o) => (
                    <Card key={o.id} className="cursor-pointer hover:card-shadow-hover transition-shadow" onClick={() => navigate(`/order/${o.id}`)}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Package className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{o.service_type || "服务订单"}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(o.created_at), { addSuffix: true, locale: zhCN })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-primary">¥{Number(o.total_amount).toFixed(0)}</p>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {STATUS_LABEL[o.order_status] || o.order_status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
            </div>
          </section>
        )}


        {/* Popular Services */}
        <section className="mt-8 animate-fade-in-up" style={{ animationDelay: "0.2s" }} aria-label="热门服务">
          <div className="flex items-center justify-between px-5 mb-3">
            <h2 className="text-lg font-extrabold text-foreground">🔥 热门服务</h2>
            <button type="button" className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-primary transition-colors min-h-[44px] min-w-[44px] justify-end" aria-label="查看全部服务">
              查看全部 <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-none" role="list" style={{ WebkitOverflowScrolling: "touch" }}>
            {loadingServices
              ? Array.from({ length: 4 }).map((_, i) => <ServiceSkeleton key={i} />)
              : services?.map((s) => <ServiceCard key={s.id} {...s} onClick={() => navigate("/booking")} />)}
          </div>
        </section>

        {/* Recommended Products */}
        <section className="mt-8 animate-fade-in-up" style={{ animationDelay: "0.25s" }} aria-label="推荐商品">
          <div className="flex items-center justify-between px-5 mb-3">
            <h2 className="text-lg font-extrabold text-foreground">🛍️ 推荐好物</h2>
            <button type="button" className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-primary transition-colors min-h-[44px] min-w-[44px] justify-end" onClick={() => navigate("/shop")}>
              逛商城 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-none" style={{ WebkitOverflowScrolling: "touch" }}>
            {loadingProducts
              ? Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)
              : recommended.map((p) => (
                  <Card
                    key={p.id}
                    className="shrink-0 w-36 overflow-hidden cursor-pointer hover:card-shadow-hover transition-shadow"
                    onClick={() => navigate(`/product/${p.id}`)}
                  >
                    <div className="aspect-square bg-muted flex items-center justify-center text-4xl">
                      {p.cover_image ? (
                        <img src={p.cover_image} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        getEmoji(p.category_id)
                      )}
                    </div>
                    <CardContent className="p-2">
                      <p className="text-xs font-medium text-foreground line-clamp-2 mb-1">{p.name}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-primary font-bold text-sm">¥{p.price}</span>
                        {p.original_price && <span className="text-muted-foreground text-[10px] line-through">¥{p.original_price}</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground">已售{p.sales_count}</p>
                    </CardContent>
                  </Card>
                ))}
          </div>
        </section>

        {/* Top Technicians */}
        <section className="mt-8 px-5 animate-fade-in-up" style={{ animationDelay: "0.3s" }} aria-label="附近高分技师">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-extrabold text-foreground">⭐ 附近高分技师</h2>
            <button type="button" className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-primary transition-colors min-h-[44px] min-w-[44px] justify-end" aria-label="查看更多技师">
              更多 <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-col gap-3" role="list">
            {loadingTechnicians
              ? Array.from({ length: 3 }).map((_, i) => <TechnicianSkeleton key={i} />)
              : technicians?.map((t) => <TechnicianCard key={t.id} {...t} />)}
          </div>
        </section>

        {/* Quick Actions */}
        <section className="mt-8 px-5 pb-6 animate-fade-in-up" style={{ animationDelay: "0.4s" }} aria-label="快捷入口">
          <div className="grid grid-cols-3 gap-3">
            <Button variant="warm" size="lg" className="h-auto py-4 flex-col gap-1" onClick={() => navigate("/booking")}>
              <span className="text-2xl" aria-hidden="true">🏠</span>
              <span className="font-bold text-xs">宠物寄养</span>
              <span className="text-[10px] text-muted-foreground">附近优质门店</span>
            </Button>
            <Button variant="warm" size="lg" className="h-auto py-4 flex-col gap-1" onClick={() => navigate("/booking")}>
              <span className="text-2xl" aria-hidden="true">🚗</span>
              <span className="font-bold text-xs">宠物接送</span>
              <span className="text-[10px] text-muted-foreground">安全专车服务</span>
            </Button>
            <Button variant="warm" size="lg" className="h-auto py-4 flex-col gap-1" onClick={() => navigate("/pet-hotel")}>
              <span className="text-2xl" aria-hidden="true">🏨</span>
              <span className="font-bold text-xs">友好酒店</span>
              <span className="text-[10px] text-muted-foreground">携宠入住</span>
            </Button>
          </div>
        </section>
      </main>

      <BottomNav />
      <LostPetAlert />
    </div>
  );
};

export default Index;
