import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, MessageCircle, Send, Sparkles, AtSign, CornerDownRight, Share2, ShoppingBag } from "lucide-react";
import SharePostDialog from "@/components/SharePostDialog";
import PostProductCard from "@/components/community/PostProductCard";
import ProductPicker from "@/components/community/ProductPicker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLovePoints } from "@/hooks/useLovePoints";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { checkTextSafety } from "@/lib/contentSafety";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { SafeAreaBottomLayout } from "@/components/SafeAreaBottomLayout";

interface ProfileLite {
  user_id: string;
  username: string;
  avatar_url: string | null;
}

interface PostMedia {
  id: string;
  media_url: string;
  media_type: string;
}

interface PostDetail {
  id: string;
  user_id: string;
  content: string;
  category: string;
  tags: string[] | null;
  is_featured: boolean;
  created_at: string;
  profiles: ProfileLite | null;
  media: PostMedia[];
  likes_count: number;
  liked_by_me: boolean;
}

interface CommentRow {
  id: string;
  user_id: string;
  post_id: string;
  parent_id: string | null;
  reply_to_user_id: string | null;
  reply_to_username: string | null;
  content: string;
  created_at: string;
  profiles: ProfileLite | null;
}

interface CommentNode extends CommentRow {
  children: CommentNode[];
}

const renderContentWithMentions = (text: string) => {
  // Highlight @用户名 mentions visually
  const parts = text.split(/(@[\u4e00-\u9fa5\w]+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-primary font-semibold">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
};

const PostDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { award } = useLovePoints();
  const { toast } = useToast();

  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState("");
  const [replyTarget, setReplyTarget] = useState<{ commentId: string; userId: string; username: string } | null>(null);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [candidates, setCandidates] = useState<ProfileLite[]>([]);
  const [pickedMentions, setPickedMentions] = useState<ProfileLite[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [productsRefresh, setProductsRefresh] = useState(0);

  const fetchPost = useCallback(async () => {
    if (!id) return;
    const { data: postRow } = await supabase
      .from("posts")
      .select("id, user_id, content, category, tags, is_featured, created_at")
      .eq("id", id)
      .maybeSingle();
    if (!postRow) {
      setPost(null);
      setLoading(false);
      return;
    }
    const [{ data: profile }, { data: media }, { data: likes }] = await Promise.all([
      supabase.from("profiles").select("user_id, username, avatar_url").eq("user_id", postRow.user_id).maybeSingle(),
      supabase.from("post_media").select("id, media_url, media_type").eq("post_id", id),
      supabase.from("likes").select("user_id").eq("post_id", id),
    ]);
    setPost({
      ...postRow,
      profiles: (profile as ProfileLite) ?? null,
      media: (media as PostMedia[]) ?? [],
      likes_count: likes?.length ?? 0,
      liked_by_me: !!user && !!likes?.some((l) => l.user_id === user.id),
    });
    setLoading(false);
  }, [id, user]);

  const fetchComments = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("comments")
      .select("id, user_id, post_id, parent_id, reply_to_user_id, reply_to_username, content, created_at")
      .eq("post_id", id)
      .order("created_at", { ascending: true });
    const rows = (data as CommentRow[]) ?? [];
    if (rows.length === 0) { setComments([]); return; }
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url")
      .in("user_id", userIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p as ProfileLite]));
    setComments(rows.map((r) => ({ ...r, profiles: profileMap.get(r.user_id) ?? null })));
  }, [id]);

  useEffect(() => { fetchPost(); fetchComments(); }, [fetchPost, fetchComments]);

  // @mention autocomplete: trigger on "@" + chars
  useEffect(() => {
    const m = text.match(/@([\u4e00-\u9fa5\w]{1,20})$/);
    if (m && m[1]) {
      setMentionSearch(m[1]);
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
    }
  }, [text]);

  useEffect(() => {
    if (!mentionOpen || !mentionSearch) { setCandidates([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .ilike("username", `%${mentionSearch}%`)
        .limit(6);
      if (!cancelled) setCandidates((data as ProfileLite[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [mentionOpen, mentionSearch]);

  const tree = useMemo<CommentNode[]>(() => {
    const map = new Map<string, CommentNode>();
    comments.forEach((c) => map.set(c.id, { ...c, children: [] }));
    const roots: CommentNode[] = [];
    map.forEach((node) => {
      if (node.parent_id && map.has(node.parent_id)) {
        map.get(node.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }, [comments]);

  const totalComments = comments.length;

  const startReply = (c: CommentRow) => {
    if (!user) { toast({ title: "请先登录" }); return; }
    setReplyTarget({ commentId: c.parent_id ?? c.id, userId: c.user_id, username: c.profiles?.username ?? "用户" });
    inputRef.current?.focus();
  };

  const cancelReply = () => setReplyTarget(null);

  const insertMention = (p: ProfileLite) => {
    setText((prev) => prev.replace(/@([\u4e00-\u9fa5\w]{1,20})$/, `@${p.username} `));
    setPickedMentions((prev) => prev.some((x) => x.user_id === p.user_id) ? prev : [...prev, p]);
    setMentionOpen(false);
    inputRef.current?.focus();
  };

  const submit = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!post) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const safety = checkTextSafety(trimmed);
    if (!safety.safe) { toast({ title: "内容不合规", description: safety.violations[0], variant: "destructive" }); return; }
    setSubmitting(true);
    // Resolve mentions present in text from pickedMentions
    const mentionedIds = pickedMentions
      .filter((p) => trimmed.includes(`@${p.username}`))
      .map((p) => p.user_id);
    const { error } = await supabase.from("comments").insert({
      post_id: post.id,
      user_id: user.id,
      content: trimmed,
      parent_id: replyTarget?.commentId ?? null,
      reply_to_user_id: replyTarget?.userId ?? null,
      reply_to_username: replyTarget?.username ?? null,
      mentioned_user_ids: mentionedIds.length > 0 ? mentionedIds : null,
    } as never);
    setSubmitting(false);
    if (error) { toast({ title: "评论失败", description: error.message, variant: "destructive" }); return; }
    setText(""); setPickedMentions([]); setReplyTarget(null);
    fetchComments();
  };

  const toggleLike = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!post) return;
    if (post.liked_by_me) {
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      setPost({ ...post, liked_by_me: false, likes_count: Math.max(0, post.likes_count - 1) });
    } else {
      await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
      setPost({ ...post, liked_by_me: true, likes_count: post.likes_count + 1 });
      // Trigger handles author's points; nothing extra for liker.
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">动态不存在或已被删除</p>
        <Button variant="hero" onClick={() => navigate("/community")}>返回社区</Button>
      </div>
    );
  }

  return (
    <SafeAreaBottomLayout
      className="min-h-screen bg-background"
      data-testid="post-detail-layout"
      bottomBarClassName="bg-background/95 backdrop-blur-md border-t border-border"
      bottomBar={
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
          {replyTarget && (
            <div className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground">
              <span className="flex items-center gap-1">
                <CornerDownRight className="w-3 h-3" /> 回复 <span className="text-primary font-semibold">@{replyTarget.username}</span>
              </span>
              <button onClick={cancelReply} className="text-muted-foreground hover:text-foreground font-medium">取消</button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Popover open={mentionOpen && candidates.length > 0} onOpenChange={setMentionOpen}>
              <PopoverTrigger asChild>
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={user ? (replyTarget ? `回复 @${replyTarget.username}…` : "盖楼评论… 输入 @ 提及好友") : "登录后参与评论"}
                    disabled={!user}
                    maxLength={500}
                    className="pr-9 h-11 text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !mentionOpen) { e.preventDefault(); submit(); } }}
                  />
                  <button
                    type="button"
                    onClick={() => { setText((prev) => prev + "@"); setTimeout(() => inputRef.current?.focus(), 0); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-primary"
                    aria-label="@提及"
                  >
                    <AtSign className="w-4 h-4" />
                  </button>
                </div>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
                <ul className="max-h-64 overflow-y-auto">
                  {candidates.map((p) => (
                    <li key={p.user_id}>
                      <button
                        type="button"
                        onClick={() => insertMention(p)}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-secondary text-left"
                      >
                        <Avatar className="w-7 h-7">
                          <AvatarImage src={p.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">{p.username[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-foreground truncate">{p.username}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
            <Button variant="hero" size="sm" className="h-11 rounded-xl gap-1" onClick={submit} disabled={submitting || !text.trim() || !user}>
              <Send className="w-4 h-4" /> 发送
            </Button>
          </div>
          {!user && (
            <p className="text-xs text-center text-muted-foreground">
              <Link to="/auth" className="text-primary font-semibold">登录</Link> 后可评论盖楼
            </p>
          )}
        </div>
      }
    >
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/50">
        <div className="max-w-2xl mx-auto h-14 flex items-center gap-3 px-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="返回">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-extrabold text-lg text-foreground">动态详情</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Post */}
        <article className="bg-card rounded-2xl card-shadow overflow-hidden">
          <div className="p-4 flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={post.profiles?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                {(post.profiles?.username || "宠")[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm text-foreground truncate">{post.profiles?.username || "宠物主人"}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: zhCN })}
              </p>
            </div>
            {post.is_featured && (
              <Badge className="bg-status-featured text-status-featured-foreground gap-1">
                <Sparkles className="w-3 h-3" /> 加精
              </Badge>
            )}
          </div>

          {post.content && (
            <p className="px-4 pb-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
              {renderContentWithMentions(post.content)}
            </p>
          )}

          {post.tags && post.tags.length > 0 && (
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[11px]">#{tag}</Badge>
              ))}
            </div>
          )}

          {post.media.filter((m) => m.media_type !== "live_photo_video").length > 0 && (
            <div className={cn("grid gap-1", post.media.filter((m) => m.media_type !== "live_photo_video").length === 1 ? "grid-cols-1" : "grid-cols-2")}>
              {post.media
                .filter((m) => m.media_type !== "live_photo_video")
                .map((m) => {
                  const isVid = m.media_type === "video" || m.media_type === "live_photo_video";
                  const isLive = m.media_type === "live_photo_image";
                  return (
                    <div key={m.id} className="relative">
                      {isVid ? (
                        <video src={m.media_url} className="w-full object-cover" controls playsInline preload="metadata" />
                      ) : (
                        <img src={m.media_url} alt="" className="w-full object-cover" loading="lazy" />
                      )}
                      {m.media_type === "video" && (
                        <span className="absolute bottom-1 left-1 bg-foreground/70 text-background text-[10px] px-1.5 py-0.5 rounded-full">视频</span>
                      )}
                      {isLive && (
                        <span className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-semibold">✨ Live</span>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          <PostProductCard key={productsRefresh} postId={post.id} />

          <div className="px-4 py-3 flex items-center gap-5 border-t border-border/50">
            <button onClick={toggleLike} className={cn("flex items-center gap-1.5 text-sm transition-colors min-h-[36px]", post.liked_by_me ? "text-destructive" : "text-muted-foreground hover:text-destructive")}>
              <Heart className={cn("w-5 h-5", post.liked_by_me && "fill-current")} />
              <span className="font-semibold">{post.likes_count}</span>
            </button>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MessageCircle className="w-5 h-5" />
              <span className="font-semibold">{totalComments}</span>
            </div>
            <button
              onClick={() => setShareOpen(true)}
              className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors min-h-[36px]"
              aria-label="分享"
            >
              <Share2 className="w-5 h-5" />
              <span className="font-semibold">分享</span>
            </button>
          </div>
          {user?.id === post.user_id && (
            <div className="px-4 pb-3">
              <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => setPickerOpen(true)}>
                <ShoppingBag className="w-4 h-4" />挂载商城商品
              </Button>
            </div>
          )}
        </article>

        <ProductPicker open={pickerOpen} onOpenChange={setPickerOpen} postId={post.id} onAdded={() => setProductsRefresh((n) => n + 1)} />

        {post && (
          <SharePostDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            postId={post.id}
            authorName={post.profiles?.username || "宠物主人"}
            authorAvatar={post.profiles?.avatar_url}
            contentSnippet={post.content}
            coverImage={post.media[0]?.media_url || null}
          />
        )}

        {/* Comments */}
        <section className="bg-card rounded-2xl card-shadow p-4">
          <h2 className="font-bold text-sm text-foreground mb-3">全部评论 · {totalComments}</h2>
          {tree.length === 0 ? (
            <p className="text-center py-10 text-sm text-muted-foreground">还没有评论，来抢沙发 🛋️</p>
          ) : (
            <ul className="space-y-4">
              {tree.map((node, idx) => (
                <li key={node.id} className="space-y-2">
                  <CommentItem comment={node} floor={idx + 1} onReply={startReply} />
                  {node.children.length > 0 && (
                    <ul className="ml-10 pl-3 border-l-2 border-border/60 space-y-2.5">
                      {node.children.map((child) => (
                        <li key={child.id}>
                          <CommentItem comment={child} isReply onReply={startReply} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

    </SafeAreaBottomLayout>
  );
};

interface CommentItemProps {
  comment: CommentNode;
  isReply?: boolean;
  floor?: number;
  onReply: (c: CommentRow) => void;
}

const CommentItem = ({ comment, isReply, floor, onReply }: CommentItemProps) => {
  return (
    <div className="flex gap-2.5">
      <Avatar className={cn(isReply ? "w-7 h-7" : "w-9 h-9", "flex-shrink-0")}>
        <AvatarImage src={comment.profiles?.avatar_url || undefined} />
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
          {(comment.profiles?.username || "宠")[0]}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-foreground">{comment.profiles?.username || "宠物主人"}</span>
          {floor !== undefined && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{floor}楼</span>
          )}
        </div>
        <div className="text-sm text-foreground leading-relaxed break-words mt-0.5">
          {comment.reply_to_username && comment.parent_id && (
            <span className="text-xs text-muted-foreground mr-1">
              回复 <span className="text-primary font-medium">@{comment.reply_to_username}</span>:
            </span>
          )}
          {renderContentWithMentions(comment.content)}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: zhCN })}</span>
          <button onClick={() => onReply(comment)} className="hover:text-primary font-medium">回复</button>
        </div>
      </div>
    </div>
  );
};

export default PostDetailPage;
