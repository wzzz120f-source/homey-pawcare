import { useState, useEffect, useRef, Suspense, Component, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserBadges, tryAutoAwardBadges } from "@/hooks/useUserBadges";
import { UserBadgeRow } from "@/components/community/UserBadgeChip";
import { POST_CATEGORIES, HOT_TAGS, type PostCategory } from "@/config/communityCategories";
import { checkTextSafety, checkImageHint } from "@/lib/contentSafety";
import { type PreparedMedia, uploadPreparedMedia, revokePreviews } from "@/lib/mediaUpload";
import MediaPicker from "@/components/MediaPicker";
import MediaThumb from "@/components/MediaThumb";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Heart, MessageCircle, Image as ImageIcon, Send, X, Plus,
  LogIn, Hash, Sparkles, ShieldCheck, Radar, AlertTriangle, RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { lazyTracked } from "@/lib/chunkRecovery";
import ChunkStatusWidget from "@/components/community/ChunkStatusWidget";
import CommunitySearchBar from "@/components/community/CommunitySearchBar";

const GuardianChannel = lazyTracked(
  "守护频道 GuardianChannel",
  () => import("@/components/community/GuardianChannel"),
  { critical: true },
);
const PetRadar = lazyTracked(
  "寻宠雷达 PetRadar",
  () => import("@/components/community/PetRadar"),
  { critical: true },
);

type CommunityLazyError = Error & { communityModule?: string; detectedAt?: string };
type CommunityStatusState = { error: CommunityLazyError | null; retryKey: number; retrying: boolean };

class CommunityLazyBoundary extends Component<
  { children: (retryKey: number) => ReactNode; activeTab: string; onBack: () => void; moduleName: string; retryFactory: () => Promise<unknown> },
  CommunityStatusState
> {
  state: CommunityStatusState = { error: null, retryKey: 0, retrying: false };

  static getDerivedStateFromError(error: CommunityLazyError) {
    return { error };
  }

  componentDidUpdate(prevProps: { activeTab: string }) {
    if (prevProps.activeTab !== this.props.activeTab && this.state.error) {
      this.setState({ error: null, retrying: false });
    }
  }

  handleRetry = async () => {
    this.setState({ retrying: true });
    try {
      // Try the import again first; if it succeeds, remount Suspense via retryKey.
      await this.props.retryFactory();
      this.setState((s) => ({ error: null, retrying: false, retryKey: s.retryKey + 1 }));
      toast.success("已重新加载模块");
    } catch (err) {
      const e = err as CommunityLazyError;
      Object.assign(e, { communityModule: this.props.moduleName, detectedAt: new Date().toISOString() });
      this.setState({ error: e, retrying: false });
      toast.error("仍然无法加载，请稍后再试或刷新页面");
    }
  };

  render() {
    if (!this.state.error) return this.props.children(this.state.retryKey);
    return (
      <CommunityStatusPanel
        error={this.state.error}
        retrying={this.state.retrying}
        onRetry={this.handleRetry}
        onBack={this.props.onBack}
      />
    );
  }
}

const CommunityStatusPanel = ({
  error,
  retrying,
  onRetry,
  onBack,
}: {
  error: CommunityLazyError;
  retrying: boolean;
  onRetry: () => void;
  onBack: () => void;
}) => {
  const message = error?.message || "社区模块加载失败";
  const isLazyLoadFailure = /dynamically imported module|import|fetch|Loading chunk/i.test(message);
  const moduleLabel = error.communityModule || "社区动态模块";

  return (
    <section className="px-4 py-6">
      <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl">
          🐾
        </div>
        <h3 className="text-base font-extrabold text-foreground">这片小天地暂时没打开</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {isLazyLoadFailure
            ? `「${moduleLabel}」加载失败了，可能是网络不稳或预览缓存了旧版本。`
            : `「${moduleLabel}」遇到了一些小麻烦，让我们一起再试一次。`}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <Button
            size="lg"
            variant="hero"
            className="w-full rounded-xl gap-2"
            onClick={onRetry}
            disabled={retrying}
          >
            <RefreshCcw className={cn("h-4 w-4", retrying && "animate-spin")} />
            {retrying ? "重新加载中…" : "再试一次"}
          </Button>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" className="flex-1 rounded-xl" onClick={onBack}>
              回到爱心广场
            </Button>
            <Button size="sm" variant="ghost" className="flex-1 rounded-xl" onClick={() => window.location.reload()}>
              刷新整个页面
            </Button>
          </div>
        </div>

        <details className="mt-4 text-left">
          <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">查看技术详情</summary>
          <div className="mt-2 rounded-xl border border-border/60 bg-background/70 p-3 text-[11px] text-muted-foreground">
            <div className="flex justify-between gap-3"><span>模块</span><span className="truncate font-semibold text-foreground">{moduleLabel}</span></div>
            <div className="mt-1 flex justify-between gap-3"><span>类型</span><span className="font-semibold text-foreground">{error.name || "TypeError"}</span></div>
            <div className="mt-1 flex justify-between gap-3"><span>时间</span><span className="font-semibold text-foreground">{new Date(error.detectedAt || Date.now()).toLocaleTimeString()}</span></div>
            <p className="mt-2 break-words font-mono text-[10px] leading-relaxed">{message}</p>
          </div>
        </details>
      </div>
    </section>
  );
};

interface Post {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  tags: string[];
  category: string;
  is_featured: boolean;
  profiles: { username: string; avatar_url: string } | null;
  media: { id: string; media_url: string; media_type: string }[];
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
}

const CommunityPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as "plaza" | "guardian" | "radar") || "plaza";
  const [activeTab, setActiveTab] = useState<"plaza" | "guardian" | "radar">(
    ["plaza", "guardian", "radar"].includes(initialTab) ? initialTab : "plaza"
  );

  // ===== 爱心广场 state =====
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<PostCategory>("life");
  const [mediaItems, setMediaItems] = useState<PreparedMedia[]>([]);
  const [posting, setPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<PostCategory>("all");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  // file input handled inside MediaPicker component

  const userIds = posts.map((p) => p.user_id);
  const badgeMap = useUserBadges(userIds);

  const fetchPosts = async () => {
    let query: any = (supabase as any)
      .from("posts")
      .select("id, user_id, content, created_at, tags, category, is_featured")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);

    if (filterCategory !== "all") query = query.eq("category", filterCategory);
    if (filterTag) query = query.contains("tags", [filterTag]);
    if (searchTerm.trim()) query = query.ilike("content", `%${searchTerm.trim()}%`);

    const { data: postsData, error } = await query;
    if (error || !postsData) {
      setLoading(false);
      return;
    }

    const enriched: Post[] = await Promise.all(
      (postsData as any[]).map(async (post) => {
        const [profileRes, mediaRes, likesRes, commentsRes, myLikeRes] = await Promise.all([
          supabase.from("profiles").select("username, avatar_url").eq("user_id", post.user_id).maybeSingle(),
          supabase.from("post_media").select("id, media_url, media_type").eq("post_id", post.id),
          supabase.from("likes").select("id", { count: "exact", head: true }).eq("post_id", post.id),
          supabase.from("comments").select("id", { count: "exact", head: true }).eq("post_id", post.id),
          user ? supabase.from("likes").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        return {
          ...post,
          tags: post.tags || [],
          category: post.category || "life",
          is_featured: !!post.is_featured,
          profiles: profileRes.data,
          media: mediaRes.data || [],
          likes_count: likesRes.count || 0,
          comments_count: commentsRes.count || 0,
          liked_by_me: !!(myLikeRes as any).data,
        };
      })
    );

    setPosts(enriched);
    setLoading(false);
  };

  useEffect(() => {
    if (activeTab !== "plaza") return;
    fetchPosts();
    const channel = supabase
      .channel("posts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => fetchPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filterCategory, filterTag, activeTab, searchTerm]);

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "");
    if (t && !tags.includes(t) && tags.length < 5) setTags((p) => [...p, t]);
    setTagInput("");
  };
  const removeTag = (tag: string) => setTags((p) => p.filter((t) => t !== tag));
  const addHotTag = (tag: string) => {
    if (!tags.includes(tag) && tags.length < 5) setTags((p) => [...p, tag]);
  };

  const onMediaChange = (next: PreparedMedia[]) => {
    // 文件名暗示检测（限制收款码）
    for (const m of next) {
      const r = checkImageHint(m.file);
      if (!r.safe) {
        toast.error(`图片被拦截：${r.violations.join("，")}。严禁个人收款码。`);
        return;
      }
    }
    setMediaItems(next);
  };

  const handlePost = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!newContent.trim() && mediaItems.length === 0) { toast.error("请输入内容或添加媒体"); return; }

    // 文本安全检测
    const safety = checkTextSafety(newContent);
    if (!safety.safe) {
      toast.error(`发布被拦截：${safety.violations.join("；")}`);
      await supabase.from("content_violations").insert({
        user_id: user.id,
        content_type: "post",
        content_snippet: newContent.slice(0, 200),
        violation_type: safety.violations.join(","),
      } as any);
      return;
    }

    setPosting(true);
    try {
      const { data: post, error } = await supabase
        .from("posts")
        .insert({ user_id: user.id, content: newContent.trim(), tags, category: newCategory } as any)
        .select("id")
        .single();
      if (error) throw error;

      const mediaInserts: { post_id: string; media_url: string; media_type: string }[] = [];
      for (const item of mediaItems) {
        const { url, mediaType } = await uploadPreparedMedia(supabase, "community-media", user.id, item, "media");
        mediaInserts.push({ post_id: post.id, media_url: url, media_type: mediaType });
      }
      if (mediaInserts.length > 0) await supabase.from("post_media").insert(mediaInserts);

      // 自动勋章 + 爱心积分
      tryAutoAwardBadges(user.id);
      await (supabase as any).rpc("award_love_points", {
        _action: "post_create", _points: 10,
        _related_type: "post", _related_id: post.id,
        _description: "发布动态",
      });

      toast.success("发布成功！+10 爱心积分 ❤️");
      revokePreviews(mediaItems);
      setNewContent(""); setMediaItems([]); setTags([]);
      setShowCreate(false); fetchPosts();
    } catch (e: any) { toast.error(e.message || "发布失败"); }
    finally { setPosting(false); }
  };

  const toggleLike = async (postId: string) => {
    if (!user) { navigate("/auth"); return; }
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    if (post.liked_by_me) {
      await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      // 触发器自动给作者发 +2 积分
      await supabase.from("likes").insert({ user_id: user.id, post_id: postId });
    }
    fetchPosts();
  };

  const loadComments = async (postId: string) => {
    const { data } = await supabase.from("comments").select("id, content, created_at, user_id")
      .eq("post_id", postId).order("created_at", { ascending: true });
    if (data) {
      const enriched = await Promise.all(data.map(async (c) => {
        const { data: profile } = await supabase.from("profiles").select("username, avatar_url").eq("user_id", c.user_id).maybeSingle();
        return { ...c, profiles: profile };
      }));
      setComments((p) => ({ ...p, [postId]: enriched }));
    }
  };
  const toggleComments = (id: string) => {
    if (expandedComments === id) setExpandedComments(null);
    else { setExpandedComments(id); loadComments(id); }
    setCommentText("");
  };
  const submitComment = async (postId: string) => {
    if (!user) { navigate("/auth"); return; }
    if (!commentText.trim()) return;
    const safety = checkTextSafety(commentText);
    if (!safety.safe) { toast.error(`评论被拦截：${safety.violations.join("；")}`); return; }
    await supabase.from("comments").insert({ user_id: user.id, post_id: postId, content: commentText.trim() });
    setCommentText(""); loadComments(postId); fetchPosts();
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐾</span>
            <span className="font-extrabold text-lg text-foreground">爱心宠物社区</span>
          </div>
          {user ? (
            activeTab === "plaza" && (
              <Button size="sm" variant="hero" className="rounded-full gap-1" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4" /> 发帖
              </Button>
            )
          ) : (
            <Button size="sm" variant="warm" className="rounded-full gap-1" onClick={() => navigate("/auth")}>
              <LogIn className="w-4 h-4" /> 登录
            </Button>
          )}
        </div>

        {/* 三大模块 Tab */}
        <div className="max-w-lg mx-auto px-4 pb-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid grid-cols-3 w-full bg-secondary rounded-xl p-1 h-11">
              <TabsTrigger value="plaza" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Sparkles className="w-3.5 h-3.5" /> <span className="text-xs font-semibold">爱心广场</span>
              </TabsTrigger>
              <TabsTrigger value="guardian" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5" /> <span className="text-xs font-semibold">守护频道</span>
              </TabsTrigger>
              <TabsTrigger value="radar" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Radar className="w-3.5 h-3.5" /> <span className="text-xs font-semibold">寻宠雷达</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <CommunitySearchBar activeTab={activeTab} value={searchTerm} onChange={setSearchTerm} />
        <ChunkStatusWidget />
      </header>

      <main className="max-w-lg mx-auto">
        {activeTab === "plaza" && (
          <>
            {/* 分类 chips */}
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2 px-4 pt-3 pb-2">
                {POST_CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setFilterCategory(c.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition-colors flex-shrink-0",
                      filterCategory === c.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <span>{c.icon}</span>{c.label}
                  </button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="hidden" />
            </ScrollArea>

            {/* 标签筛选状态 */}
            {filterTag && (
              <div className="px-4 pt-1 pb-1 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">标签：</span>
                <Badge variant="default" className="gap-1 cursor-pointer" onClick={() => setFilterTag(null)}>
                  #{filterTag} <X className="w-3 h-3" />
                </Badge>
              </div>
            )}

            {/* 创建动态弹窗 */}
            {showCreate && (
              <div className="fixed inset-0 z-[60] bg-foreground/50 flex items-end sm:items-center justify-center" onClick={() => setShowCreate(false)}>
                <div className="bg-background w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 pb-24 sm:pb-5 max-h-[88vh] overflow-y-auto animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-extrabold text-lg text-foreground">分享你的故事</h3>
                    <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-secondary">
                      <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </div>

                  {/* 分类选择 */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {POST_CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setNewCategory(c.value as PostCategory)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-colors",
                          newCategory === c.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {c.icon} {c.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="分享毛孩子的萌照/经验/避雷 ✨ #小红书风格# 多用标签收获更多曝光"
                    rows={4}
                    maxLength={2000}
                    className="w-full p-3 rounded-xl bg-secondary text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary resize-none"
                  />

                  {/* Tags */}
                  <div className="mt-3">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-muted-foreground" />
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                        placeholder="标签 (≤5)"
                        className="text-sm h-9 flex-1"
                        maxLength={20}
                      />
                      <Button size="sm" variant="secondary" className="h-9 rounded-xl" onClick={addTag}>添加</Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {HOT_TAGS.filter((t) => !tags.includes(t)).slice(0, 5).map((t) => (
                        <Badge key={t} variant="outline" className="cursor-pointer text-[10px] hover:bg-primary hover:text-primary-foreground" onClick={() => addHotTag(t)}>
                          + {t}
                        </Badge>
                      ))}
                    </div>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeTag(tag)}>
                            #{tag} <X className="w-3 h-3" />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-3">
                    <MediaPicker value={mediaItems} onChange={onMediaChange} maxItems={9} thumbClassName="w-20 h-20" />
                  </div>

                  {/* 安全提示 */}
                  <div className="mt-3 flex items-start gap-2 text-[11px] text-status-warn-foreground bg-status-warn border border-status-warn-border rounded-lg p-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>严禁发布个人收款码、二维码、微信号求转账。所有救助物资请走平台正规渠道。</span>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <Button variant="hero" size="sm" className="ml-auto rounded-xl gap-1 min-h-[44px]" onClick={handlePost} disabled={posting}>
                      <Send className="w-4 h-4" /> {posting ? "发布中..." : "发布"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 瀑布流 (2 列) */}
            <div className="px-3 pt-2 pb-4">
              {loading ? (
                <div className="flex justify-center py-20">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <span className="text-4xl block mb-3">🐾</span>
                  <p className="font-medium">还没有动态，来发第一条吧！</p>
                </div>
              ) : (
                <div className="columns-2 gap-2 [&>*]:mb-2 [&>*]:break-inside-avoid">
                  {posts.map((post) => {
                    // Live Photo 视频片段折叠在主图上，不参与封面
                    const visible = post.media.filter((m) => m.media_type !== "live_photo_video");
                    const cover = visible[0];
                    return (
                      <article key={post.id} className="bg-card rounded-2xl overflow-hidden card-shadow animate-fade-in-up">
                        {/* 封面图 / 视频 */}
                        {cover && (
                          <button
                            type="button"
                            onClick={() => navigate(`/post/${post.id}`)}
                            className="relative block w-full text-left"
                            aria-label="查看动态详情"
                          >
                            <MediaThumb
                              url={cover.media_url}
                              mediaType={cover.media_type}
                              alt=""
                              className="w-full aspect-square"
                              videoControls={false}
                            />
                            {post.is_featured && (
                              <Badge className="absolute top-2 left-2 bg-status-featured text-status-featured-foreground text-[10px] gap-0.5">
                                <Sparkles className="w-3 h-3" /> 加精
                              </Badge>
                            )}
                            {visible.length > 1 && (
                              <Badge variant="secondary" className="absolute top-2 right-2 text-[10px] bg-foreground/60 text-background">
                                {visible.length} 个
                              </Badge>
                            )}
                          </button>
                        )}

                        <div className="p-2.5 space-y-2">
                          {/* 内容 */}
                          {post.content && (
                            <button
                              type="button"
                              onClick={() => navigate(`/post/${post.id}`)}
                              className="block w-full text-left"
                            >
                              <p className="text-xs text-foreground leading-relaxed line-clamp-3">{post.content}</p>
                            </button>
                          )}

                          {/* Tags */}
                          {post.tags && post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {post.tags.slice(0, 2).map((tag) => (
                                <button key={tag} onClick={() => setFilterTag(tag)} className="text-[10px] text-primary font-semibold">
                                  #{tag}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* 作者 + 互动 */}
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Avatar className="w-5 h-5 flex-shrink-0">
                                <AvatarImage src={post.profiles?.avatar_url} />
                                <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                                  {(post.profiles?.username || "宠")[0]}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-[10px] text-muted-foreground truncate">{post.profiles?.username || "宠物主人"}</span>
                            </div>
                            <button
                              onClick={() => toggleLike(post.id)}
                              className={cn(
                                "flex items-center gap-0.5 text-[10px] transition-colors flex-shrink-0",
                                post.liked_by_me ? "text-destructive" : "text-muted-foreground"
                              )}
                            >
                              <Heart className={cn("w-3.5 h-3.5", post.liked_by_me && "fill-current")} />
                              {post.likes_count || 0}
                            </button>
                          </div>

                          {/* 勋章 */}
                          {badgeMap[post.user_id]?.length > 0 && (
                            <UserBadgeRow badges={badgeMap[post.user_id]} max={1} />
                          )}

                          {/* 评论入口 - 跳转详情页盖楼 */}
                          <button
                            onClick={() => navigate(`/post/${post.id}`)}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary"
                          >
                            <MessageCircle className="w-3 h-3" /> {(post.comments_count || 0) > 0 ? `查看全部 ${post.comments_count} 条评论` : "抢沙发"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "guardian" && (
          <CommunityLazyBoundary
            activeTab={activeTab}
            onBack={() => setActiveTab("plaza")}
            moduleName="守护频道 GuardianChannel"
            retryFactory={() => import("@/components/community/GuardianChannel")}
          >
            {(retryKey) => (
              <Suspense key={retryKey} fallback={<div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
                <GuardianChannel />
              </Suspense>
            )}
          </CommunityLazyBoundary>
        )}

        {activeTab === "radar" && (
          <CommunityLazyBoundary
            activeTab={activeTab}
            onBack={() => setActiveTab("plaza")}
            moduleName="寻宠雷达 PetRadar"
            retryFactory={() => import("@/components/community/PetRadar")}
          >
            {(retryKey) => (
              <Suspense key={retryKey} fallback={<div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
                <PetRadar />
              </Suspense>
            )}
          </CommunityLazyBoundary>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default CommunityPage;
