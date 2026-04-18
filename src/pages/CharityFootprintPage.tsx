import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Award, HeartHandshake, Search, MapPin, Sparkles, CheckCircle2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { UserBadgeChip, type UserBadge } from "@/components/community/UserBadgeChip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RescueStory {
  id: string;
  pet_name: string;
  pet_type: string;
  status: string;
  story: string;
  before_image: string | null;
  after_image: string | null;
  cloud_feed_count: number;
  cloud_feed_points: number;
  created_at: string;
  location: string | null;
}

interface LostPet {
  id: string;
  pet_name: string;
  pet_type: string;
  status: string;
  last_seen_location: string;
  lost_at: string;
  reward_points: number;
  image_url: string | null;
  clue_count: number;
}

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  searching: { text: "寻找中", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  found: { text: "已找回", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  rescuing: { text: "救助中", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  recovered: { text: "已康复", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  adopted: { text: "已领养", className: "bg-primary/10 text-primary" },
};

const CharityFootprintPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [rescues, setRescues] = useState<RescueStory[]>([]);
  const [lostPets, setLostPets] = useState<LostPet[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    const [badgesRes, rescuesRes, lostRes] = await Promise.all([
      supabase.from("user_badges").select("id, badge_code, badge_name, badge_icon, badge_level").eq("user_id", user.id).order("awarded_at", { ascending: false }),
      supabase.from("rescue_stories").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("lost_pets").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setBadges((badgesRes.data || []) as UserBadge[]);
    setRescues((rescuesRes.data || []) as RescueStory[]);

    const lp = (lostRes.data || []) as any[];
    if (lp.length > 0) {
      const ids = lp.map((p) => p.id);
      const { data: clues } = await supabase.from("lost_pet_clues").select("lost_pet_id").in("lost_pet_id", ids);
      const counts: Record<string, number> = {};
      (clues || []).forEach((c: any) => {
        counts[c.lost_pet_id] = (counts[c.lost_pet_id] || 0) + 1;
      });
      setLostPets(lp.map((p) => ({ ...p, clue_count: counts[p.id] || 0 })));
    } else {
      setLostPets([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  const markAsFound = async (id: string) => {
    setUpdatingId(id);
    const { error } = await supabase.from("lost_pets").update({ status: "found" }).eq("id", id);
    setUpdatingId(null);
    if (error) {
      toast.error("更新失败");
      return;
    }
    toast.success("🎉 恭喜找回宠物！");
    setLostPets((prev) => prev.map((p) => (p.id === id ? { ...p, status: "found" } : p)));
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalCloudFeedPoints = rescues.reduce((sum, r) => sum + (r.cloud_feed_points || 0), 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-2 px-2 h-14 max-w-lg mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="返回" className="min-w-11 min-h-11">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-extrabold text-lg text-foreground">公益足迹</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4">
        {/* Stats Header */}
        <div className="mt-4 grid grid-cols-4 gap-2 bg-gradient-to-br from-primary/10 via-secondary/30 to-background rounded-2xl p-4 card-shadow">
          <Stat label="勋章" value={badges.length} icon="🏅" />
          <Stat label="救助" value={rescues.length} icon="🐾" />
          <Stat label="走失登记" value={lostPets.length} icon="🔍" />
          <Stat label="云投喂积分" value={totalCloudFeedPoints} icon="❤️" />
        </div>

        <Tabs defaultValue="badges" className="mt-5">
          <TabsList className="w-full grid grid-cols-3 h-11">
            <TabsTrigger value="badges" className="gap-1.5"><Award className="w-4 h-4" />我的勋章</TabsTrigger>
            <TabsTrigger value="rescues" className="gap-1.5"><HeartHandshake className="w-4 h-4" />我的救助</TabsTrigger>
            <TabsTrigger value="lost" className="gap-1.5"><Search className="w-4 h-4" />走失登记</TabsTrigger>
          </TabsList>

          {/* 勋章 */}
          <TabsContent value="badges" className="mt-4 space-y-3">
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            ) : badges.length === 0 ? (
              <EmptyState icon="🏅" title="暂未获得勋章" desc="参与发帖、救助、寻宠等公益活动可获得勋章" cta="去爱心广场" onClick={() => navigate("/community")} />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {badges.map((b) => (
                  <div key={b.badge_code} className="bg-card rounded-xl p-4 border border-border/50 card-shadow flex flex-col items-center text-center gap-2">
                    <div className="text-4xl">{b.badge_icon}</div>
                    <div className="font-bold text-sm text-foreground">{b.badge_name}</div>
                    <UserBadgeChip badge={b} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 救助 */}
          <TabsContent value="rescues" className="mt-4 space-y-3">
            {loading ? (
              <>{[1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</>
            ) : rescues.length === 0 ? (
              <EmptyState icon="🐾" title="还未发布救助故事" desc="记录你救助流浪动物的暖心故事，获得社区支持" cta="去守护频道" onClick={() => navigate("/community")} />
            ) : (
              rescues.map((r) => {
                const status = STATUS_LABEL[r.status] || { text: r.status, className: "bg-muted text-muted-foreground" };
                return (
                  <div key={r.id} className="bg-card rounded-xl p-4 border border-border/50 card-shadow">
                    <div className="flex items-start gap-3">
                      {r.before_image && (
                        <img src={r.before_image} alt={r.pet_name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-foreground">{r.pet_name}</h3>
                          <Badge className={cn("text-xs", status.className)} variant="secondary">{status.text}</Badge>
                        </div>
                        {r.location && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{r.location}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{r.story}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className="text-primary font-semibold">❤️ {r.cloud_feed_count} 次投喂</span>
                          <span className="text-muted-foreground">+{r.cloud_feed_points} 积分</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* 走失 */}
          <TabsContent value="lost" className="mt-4 space-y-3">
            {loading ? (
              <>{[1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</>
            ) : lostPets.length === 0 ? (
              <EmptyState icon="🔍" title="暂无走失登记" desc="如有不幸走失，可在寻宠雷达发布信息" cta="去寻宠雷达" onClick={() => navigate("/community")} />
            ) : (
              lostPets.map((p) => {
                const status = STATUS_LABEL[p.status] || { text: p.status, className: "bg-muted text-muted-foreground" };
                return (
                  <div key={p.id} className="bg-card rounded-xl p-4 border border-border/50 card-shadow">
                    <div className="flex items-start gap-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.pet_name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center text-3xl flex-shrink-0">
                          {p.pet_type === "cat" ? "🐱" : "🐶"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-foreground">{p.pet_name}</h3>
                          <Badge className={cn("text-xs", status.className)} variant="secondary">{status.text}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{p.last_seen_location}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          走失于 {formatDistanceToNow(new Date(p.lost_at), { locale: zhCN, addSuffix: true })}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className="text-primary font-semibold">🎁 悬赏 {p.reward_points} 积分</span>
                          <span className="text-muted-foreground">📍 {p.clue_count} 条线索</span>
                        </div>
                        {p.status === "searching" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2.5 h-9 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                            disabled={updatingId === p.id}
                            onClick={() => markAsFound(p.id)}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {updatingId === p.id ? "更新中..." : "标记为已找回"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </main>
      <BottomNav />
    </div>
  );
};

const Stat = ({ label, value, icon }: { label: string; value: number; icon: string }) => (
  <div className="text-center">
    <div className="text-2xl">{icon}</div>
    <div className="text-lg font-extrabold text-foreground mt-0.5">{value}</div>
    <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
  </div>
);

const EmptyState = ({ icon, title, desc, cta, onClick }: { icon: string; title: string; desc: string; cta: string; onClick: () => void }) => (
  <div className="bg-card rounded-2xl p-8 text-center border border-border/50 card-shadow">
    <div className="text-5xl mb-3">{icon}</div>
    <p className="font-bold text-foreground">{title}</p>
    <p className="text-sm text-muted-foreground mt-1.5 mb-4">{desc}</p>
    <Button variant="hero" className="rounded-xl min-h-11" onClick={onClick}>{cta}</Button>
  </div>
);

export default CharityFootprintPage;
