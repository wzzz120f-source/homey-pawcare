import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera, Edit3, LogOut, Heart, MessageCircle, ShoppingBag, Tag, Clock, Trash2, Package, Store, FileText, ShieldCheck } from "lucide-react";
import { useMerchantOwnership } from "@/hooks/useMerchantOwnership";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { zhCN } from "date-fns/locale";

interface Profile {
  username: string;
  avatar_url: string | null;
  bio: string | null;
  love_points: number;
}

interface UserPost {
  id: string;
  content: string;
  created_at: string;
  tags: string[];
  media: { id: string; media_url: string; media_type: string }[];
  likes_count: number;
  comments_count: number;
}

interface Order {
  id: string;
  order_no: string;
  order_type: string;
  service_type: string | null;
  total_amount: number;
  payment_status: string;
  order_status: string;
  payment_method: string | null;
  created_at: string;
  booking_date: string | null;
  booking_time: string | null;
}

interface UserCoupon {
  id: string;
  is_used: boolean;
  claimed_at: string;
  coupon: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    discount_type: string;
    discount_value: number;
    min_order_amount: number;
    valid_until: string;
  };
}

interface FavoriteItem {
  id: string;
  created_at: string;
  product: {
    id: string;
    name: string;
    price: number;
    original_price: number | null;
    category_id: string | null;
  };
}

interface HistoryItem {
  id: string;
  viewed_at: string;
  product: {
    id: string;
    name: string;
    price: number;
    category_id: string | null;
  };
}

type ProfileTab = "posts" | "orders" | "coupons" | "favorites" | "history";

const TABS: { key: ProfileTab; label: string; icon: typeof Heart }[] = [
  { key: "posts", label: "动态", icon: MessageCircle },
  { key: "orders", label: "订单", icon: ShoppingBag },
  { key: "coupons", label: "优惠券", icon: Tag },
  { key: "favorites", label: "收藏", icon: Heart },
  { key: "history", label: "足迹", icon: Clock },
];

const CATEGORY_EMOJI: Record<string, string> = {
  "c1111111-1111-1111-1111-111111111111": "🐱",
  "c2222222-2222-2222-2222-222222222222": "🐶",
  "c3333333-3333-3333-3333-333333333333": "🧸",
  "c4444444-4444-4444-4444-444444444444": "👕",
  "c5555555-5555-5555-5555-555555555555": "💊",
};

const getEmoji = (categoryId: string | null) => (categoryId && CATEGORY_EMOJI[categoryId]) || "🏠";

const ORDER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  created: { label: "待支付", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  confirmed: { label: "已确认", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  completed: { label: "已完成", color: "bg-muted text-muted-foreground" },
  cancelled: { label: "已取消", color: "bg-destructive/10 text-destructive" },
};

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { isMerchant, merchants: ownedMerchants } = useMerchantOwnership(user?.id);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [editOpen, setEditOpen] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("username, avatar_url, bio, love_points")
      .eq("user_id", user.id)
      .single();
    if (data) {
      setProfile(data);
      setEditUsername(data.username);
      setEditBio(data.bio || "");
    }
  };

  const fetchUserPosts = async () => {
    if (!user) return;
    const { data: postsData } = await supabase
      .from("posts")
      .select("id, content, created_at, tags")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!postsData) { setLoading(false); return; }

    const enriched: UserPost[] = await Promise.all(
      postsData.map(async (post) => {
        const [mediaRes, likesRes, commentsRes] = await Promise.all([
          supabase.from("post_media").select("id, media_url, media_type").eq("post_id", post.id),
          supabase.from("likes").select("id", { count: "exact" }).eq("post_id", post.id),
          supabase.from("comments").select("id", { count: "exact" }).eq("post_id", post.id),
        ]);
        return {
          ...post,
          tags: (post as any).tags || [],
          media: mediaRes.data || [],
          likes_count: likesRes.count || 0,
          comments_count: commentsRes.count || 0,
        };
      })
    );
    setPosts(enriched);
    setLoading(false);
  };

  const fetchOrders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setOrders(data as Order[]);
  };

  const fetchCoupons = async () => {
    if (!user) return;
    // Fetch all available coupons user hasn't claimed
    const { data: allCoupons } = await supabase.from("coupons").select("*");
    if (allCoupons) setAvailableCoupons(allCoupons);

    // Fetch user's claimed coupons
    const { data: userCoupons } = await supabase
      .from("user_coupons")
      .select("id, is_used, claimed_at, coupon_id")
      .eq("user_id", user.id);

    if (userCoupons && allCoupons) {
      const enriched = userCoupons.map((uc: any) => ({
        ...uc,
        coupon: allCoupons.find((c: any) => c.id === uc.coupon_id),
      })).filter((uc: any) => uc.coupon);
      setCoupons(enriched);
    }
  };

  const fetchFavorites = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("favorites")
      .select("id, created_at, product_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      const productIds = data.map((f: any) => f.product_id);
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id, name, price, original_price, category_id")
          .in("id", productIds);
        const enriched = data.map((f: any) => ({
          ...f,
          product: products?.find((p: any) => p.id === f.product_id),
        })).filter((f: any) => f.product);
        setFavorites(enriched);
      } else {
        setFavorites([]);
      }
    }
  };

  const fetchHistory = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("browsing_history")
      .select("id, viewed_at, product_id")
      .eq("user_id", user.id)
      .order("viewed_at", { ascending: false })
      .limit(50);

    if (data) {
      const productIds = [...new Set(data.map((h: any) => h.product_id))];
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id, name, price, category_id")
          .in("id", productIds);
        const enriched = data.map((h: any) => ({
          ...h,
          product: products?.find((p: any) => p.id === h.product_id),
        })).filter((h: any) => h.product);
        setHistory(enriched);
      } else {
        setHistory([]);
      }
    }
  };

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchUserPosts();
      fetchOrders();
      fetchCoupons();
      fetchFavorites();
      fetchHistory();
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .then(({ data }) => setIsAdmin((data || []).some((r: any) => r.role === "admin")));
    }
  }, [user]);

  const handleClaimCoupon = async (couponId: string) => {
    if (!user) return;
    const { error } = await supabase.from("user_coupons").insert({
      user_id: user.id,
      coupon_id: couponId,
    });
    if (error) {
      if (error.code === "23505") toast.info("已经领取过该优惠券");
      else toast.error("领取失败");
    } else {
      toast.success("领取成功！");
      fetchCoupons();
    }
  };

  const handleRemoveFavorite = async (favoriteId: string) => {
    await supabase.from("favorites").delete().eq("id", favoriteId);
    setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));
    toast.success("已取消收藏");
  };

  const handleClearHistory = async () => {
    if (!user) return;
    await supabase.from("browsing_history").delete().eq("user_id", user.id);
    setHistory([]);
    toast.success("浏览记录已清空");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("community-media").upload(path, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("community-media").getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("user_id", user.id);
      toast.success("头像更新成功");
      fetchProfile();
    } catch (err: any) {
      toast.error(err.message || "上传失败");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!editUsername.trim()) { toast.error("用户名不能为空"); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ username: editUsername.trim(), bio: editBio.trim() })
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("资料更新成功");
      setEditOpen(false);
      fetchProfile();
    } catch (err: any) {
      toast.error(err.message || "更新失败");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
          <span className="font-extrabold text-lg text-foreground">个人主页</span>
          <Button size="sm" variant="ghost" className="text-muted-foreground gap-1" onClick={handleSignOut}>
            <LogOut className="w-4 h-4" /> 退出
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4">
        {/* Profile Card */}
        <div className="mt-6 bg-card rounded-2xl p-6 card-shadow">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="w-20 h-20 ring-4 ring-primary/20">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                  {(profile?.username || "宠")[0]}
                </AvatarFallback>
              </Avatar>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1.5 shadow-md hover:bg-primary/90 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-foreground truncate">{profile?.username || "宠物主人"}</h2>
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogTrigger asChild>
                    <button className="p-1 rounded-lg hover:bg-secondary transition-colors">
                      <Edit3 className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>编辑资料</DialogTitle></DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">用户名</label>
                        <Input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} placeholder="输入用户名" maxLength={20} />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">个人简介</label>
                        <Textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="介绍一下你和你的宠物..." rows={3} maxLength={200} />
                        <p className="text-xs text-muted-foreground mt-1 text-right">{editBio.length}/200</p>
                      </div>
                      <Button variant="hero" className="w-full rounded-xl" onClick={handleSaveProfile} disabled={saving}>
                        {saving ? "保存中..." : "保存"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {profile?.bio || "这个人很懒，还没有写简介~"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 mt-5 pt-4 border-t border-border/50">
            <div className="text-center">
              <p className="text-lg font-extrabold text-foreground">{posts.length}</p>
              <p className="text-xs text-muted-foreground">动态</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-extrabold text-foreground">{orders.length}</p>
              <p className="text-xs text-muted-foreground">订单</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-extrabold text-foreground">{favorites.length}</p>
              <p className="text-xs text-muted-foreground">收藏</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-extrabold text-foreground">
                {posts.reduce((sum, p) => sum + p.likes_count, 0)}
              </p>
              <p className="text-xs text-muted-foreground">获赞</p>
            </div>
          </div>
        </div>

        {/* 爱心积分入口 */}
        <button
          onClick={() => navigate("/points")}
          className="mt-4 w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground rounded-2xl p-4 flex items-center justify-between card-shadow hover:opacity-95 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold">我的爱心积分</p>
              <p className="text-xs opacity-90">兑换好礼 · 公益捐赠</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-extrabold">{(profile as any)?.love_points ?? 0}</span>
            <span className="text-xs opacity-80">→</span>
          </div>
        </button>

        {/* 商家中心入口 - 仅商家可见 */}
        {isMerchant && (
          <button
            onClick={() => navigate("/merchant")}
            className="mt-3 w-full bg-card border border-primary/30 rounded-2xl p-4 flex items-center justify-between card-shadow hover:bg-primary/5 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Store className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">商家中心</p>
                <p className="text-xs text-muted-foreground">
                  {ownedMerchants.length === 1
                    ? `管理「${ownedMerchants[0].name}」的产品与图片`
                    : `管理 ${ownedMerchants.length} 家店铺`}
                </p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">→</span>
          </button>
        )}
        {!isMerchant && (
          <button
            onClick={() => navigate("/merchant/apply")}
            className="mt-3 w-full bg-card border border-border/60 rounded-2xl p-4 flex items-center justify-between card-shadow hover:bg-secondary/40 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">申请入驻萌宠到家</p>
                <p className="text-xs text-muted-foreground">提交店铺与营业执照，审核后开通商家中心</p>
              </div>
            </div>
            <span className="text-muted-foreground">→</span>
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => navigate("/merchant/admin")}
            className="mt-3 w-full bg-card border border-border/60 rounded-2xl p-4 flex items-center justify-between card-shadow hover:bg-secondary/40 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">商家入驻审核</p>
                <p className="text-xs text-muted-foreground">管理员：审核待入驻商家申请</p>
              </div>
            </div>
            <span className="text-muted-foreground">→</span>
          </button>
        )}
        <button
          onClick={() => navigate("/charity-footprint")}
          className="mt-3 w-full bg-card border border-border/60 rounded-2xl p-4 flex items-center justify-between card-shadow hover:bg-secondary/40 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-xl">
              ✨
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">我的公益足迹</p>
              <p className="text-xs text-muted-foreground">勋章 · 救助 · 走失登记</p>
            </div>
          </div>
          <span className="text-muted-foreground">→</span>
        </button>

        <div className="mt-6 flex gap-1 bg-secondary/50 rounded-xl p-1 overflow-x-auto" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg text-xs font-semibold transition-all min-w-[60px] min-h-[40px] whitespace-nowrap",
                activeTab === tab.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-4 mb-6">
          {/* Posts Tab */}
          {activeTab === "posts" && (
            <>
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : posts.length === 0 ? (
                <EmptyState emoji="📝" text="还没有动态，去社区发一条吧！" action={() => navigate("/community")} actionLabel="去发帖" />
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <article key={post.id} className="bg-card rounded-2xl p-4 card-shadow animate-fade-in-up">
                      {post.content && <p className="text-sm text-foreground leading-relaxed">{post.content}</p>}
                      {post.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {post.tags.map((tag) => <Badge key={tag} variant="secondary" className="text-xs">#{tag}</Badge>)}
                        </div>
                      )}
                      {post.media.filter((m) => m.media_type === "image").length > 0 && (
                        <div className={cn(
                          "grid gap-1.5 mt-3 rounded-xl overflow-hidden",
                          post.media.filter((m) => m.media_type === "image").length === 1 ? "grid-cols-1" :
                          post.media.filter((m) => m.media_type === "image").length === 2 ? "grid-cols-2" : "grid-cols-3"
                        )}>
                          {post.media.filter((m) => m.media_type === "image").map((m) => (
                            <img key={m.id} src={m.media_url} alt="" className="w-full aspect-square object-cover rounded-lg" />
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border/50 text-muted-foreground text-xs">
                        <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {post.likes_count}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {post.comments_count}</span>
                        <span className="ml-auto">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: zhCN })}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Orders Tab */}
          {activeTab === "orders" && (
            <>
              {orders.length === 0 ? (
                <EmptyState emoji="📦" text="暂无订单记录" action={() => navigate("/booking")} actionLabel="去预约" />
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => {
                    const status = ORDER_STATUS_MAP[order.order_status] || { label: order.order_status, color: "bg-muted text-muted-foreground" };
                    return (
                      <div
                        key={order.id}
                        className="bg-card rounded-2xl p-4 card-shadow cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => navigate(`/order/${order.id}`)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground font-mono">{order.order_no}</span>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", status.color)}>{status.label}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-sm text-foreground">{order.service_type || order.order_type}</p>
                            {order.booking_date && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {order.booking_date} {order.booking_time || ""}
                              </p>
                            )}
                          </div>
                          <span className="text-primary font-extrabold text-lg">¥{Number(order.total_amount).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30 text-xs text-muted-foreground">
                          <span>{format(new Date(order.created_at), "yyyy-MM-dd HH:mm")}</span>
                          <span>{order.payment_method === "wechat" ? "微信支付" : order.payment_method === "alipay" ? "支付宝" : "银行卡"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Coupons Tab */}
          {activeTab === "coupons" && (
            <div className="space-y-4">
              {/* Available to claim */}
              {availableCoupons.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">可领取优惠券</p>
                  <div className="space-y-2">
                    {availableCoupons.filter(c => !coupons.some(uc => uc.coupon?.id === c.id)).map((coupon: any) => (
                      <div key={coupon.id} className="bg-card rounded-2xl p-4 card-shadow flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-primary font-extrabold text-lg">
                              {coupon.discount_type === "fixed" ? `¥${coupon.discount_value}` : `${coupon.discount_value}%OFF`}
                            </span>
                            <span className="font-semibold text-sm text-foreground">{coupon.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {coupon.description} · 满¥{coupon.min_order_amount}可用
                          </p>
                        </div>
                        <Button size="sm" variant="hero" className="shrink-0" onClick={() => handleClaimCoupon(coupon.id)}>
                          领取
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Claimed coupons */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">我的优惠券</p>
                {coupons.length === 0 ? (
                  <EmptyState emoji="🎫" text="暂无已领取的优惠券" />
                ) : (
                  <div className="space-y-2">
                    {coupons.map((uc) => (
                      <div
                        key={uc.id}
                        className={cn(
                          "bg-card rounded-2xl p-4 card-shadow",
                          uc.is_used && "opacity-50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-primary font-extrabold text-lg">
                                {uc.coupon.discount_type === "fixed" ? `¥${uc.coupon.discount_value}` : `${uc.coupon.discount_value}%OFF`}
                              </span>
                              <span className="font-semibold text-sm text-foreground">{uc.coupon.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              满¥{uc.coupon.min_order_amount}可用 · 有效期至 {format(new Date(uc.coupon.valid_until), "yyyy-MM-dd")}
                            </p>
                          </div>
                          {uc.is_used ? (
                            <Badge variant="secondary">已使用</Badge>
                          ) : (
                            <Button size="sm" variant="warm" onClick={() => navigate("/shop")}>去使用</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Favorites Tab */}
          {activeTab === "favorites" && (
            <>
              {favorites.length === 0 ? (
                <EmptyState emoji="❤️" text="暂无收藏商品" action={() => navigate("/shop")} actionLabel="去逛逛" />
              ) : (
                <div className="space-y-2">
                  {favorites.map((fav) => (
                    <div key={fav.id} className="bg-card rounded-2xl p-3 card-shadow flex items-center gap-3">
                      <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center text-2xl shrink-0">
                        {getEmoji(fav.product.category_id)}
                      </div>
                      <div className="flex-1 min-w-0" onClick={() => navigate("/shop")}>
                        <p className="text-sm font-medium text-foreground truncate cursor-pointer">{fav.product.name}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-primary font-bold text-sm">¥{fav.product.price}</span>
                          {fav.product.original_price && (
                            <span className="text-muted-foreground text-xs line-through">¥{fav.product.original_price}</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFavorite(fav.id)}
                        className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                        aria-label="取消收藏"
                      >
                        <Heart className="w-4 h-4 text-primary fill-primary" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <>
              {history.length > 0 && (
                <div className="flex justify-end mb-2">
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="text-xs text-muted-foreground flex items-center gap-1 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> 清空记录
                  </button>
                </div>
              )}
              {history.length === 0 ? (
                <EmptyState emoji="👀" text="暂无浏览记录" action={() => navigate("/shop")} actionLabel="去逛逛" />
              ) : (
                <div className="space-y-2">
                  {history.map((item) => (
                    <div key={item.id} className="bg-card rounded-2xl p-3 card-shadow flex items-center gap-3" onClick={() => navigate("/shop")}>
                      <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center text-2xl shrink-0">
                        {getEmoji(item.product.category_id)}
                      </div>
                      <div className="flex-1 min-w-0 cursor-pointer">
                        <p className="text-sm font-medium text-foreground truncate">{item.product.name}</p>
                        <span className="text-primary font-bold text-sm">¥{item.product.price}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(item.viewed_at), { addSuffix: true, locale: zhCN })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

const EmptyState = ({ emoji, text, action, actionLabel }: { emoji: string; text: string; action?: () => void; actionLabel?: string }) => (
  <div className="text-center py-12 text-muted-foreground">
    <span className="text-3xl block mb-2">{emoji}</span>
    <p className="text-sm">{text}</p>
    {action && actionLabel && (
      <Button variant="hero" size="sm" className="mt-4 rounded-xl" onClick={action}>{actionLabel}</Button>
    )}
  </div>
);

export default ProfilePage;
