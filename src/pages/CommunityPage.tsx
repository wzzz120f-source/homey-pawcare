import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft, Heart, MessageCircle, Image as ImageIcon,
  Mic, Send, X, Play, Pause, Plus, LogIn,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface Post {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: { username: string; avatar_url: string } | null;
  media: { id: string; media_url: string; media_type: string }[];
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
}

const CommunityPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [posting, setPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPosts = async () => {
    const { data: postsData, error } = await supabase
      .from("posts")
      .select("id, user_id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !postsData) {
      setLoading(false);
      return;
    }

    const enriched: Post[] = await Promise.all(
      postsData.map(async (post) => {
        const [profileRes, mediaRes, likesRes, commentsRes, myLikeRes] = await Promise.all([
          supabase.from("profiles").select("username, avatar_url").eq("user_id", post.user_id).single(),
          supabase.from("post_media").select("id, media_url, media_type").eq("post_id", post.id),
          supabase.from("likes").select("id", { count: "exact" }).eq("post_id", post.id),
          supabase.from("comments").select("id", { count: "exact" }).eq("post_id", post.id),
          user ? supabase.from("likes").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle() : { data: null },
        ]);

        return {
          ...post,
          profiles: profileRes.data,
          media: mediaRes.data || [],
          likes_count: likesRes.count || 0,
          comments_count: commentsRes.count || 0,
          liked_by_me: !!myLikeRes.data,
        };
      })
    );

    setPosts(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel("posts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedImages.length > 9) {
      toast.error("最多选择9张图片");
      return;
    }
    setSelectedImages((prev) => [...prev, ...files]);
    const previews = files.map((f) => URL.createObjectURL(f));
    setImagePreviews((prev) => [...prev, ...previews]);
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setVoiceFile(new File([blob], "voice.webm", { type: "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      setIsRecording(true);
    } catch {
      toast.error("无法访问麦克风");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const uploadFile = async (file: File, folder: string) => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("community-media").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("community-media").getPublicUrl(path);
    return data.publicUrl;
  };

  const handlePost = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!newContent.trim() && selectedImages.length === 0 && !voiceFile) {
      toast.error("请输入内容或添加图片/语音");
      return;
    }

    setPosting(true);
    try {
      const { data: post, error } = await supabase
        .from("posts")
        .insert({ user_id: user.id, content: newContent.trim() })
        .select("id")
        .single();
      if (error) throw error;

      const mediaInserts: { post_id: string; media_url: string; media_type: string }[] = [];

      for (const img of selectedImages) {
        const url = await uploadFile(img, "images");
        mediaInserts.push({ post_id: post.id, media_url: url, media_type: "image" });
      }

      if (voiceFile) {
        const url = await uploadFile(voiceFile, "voices");
        mediaInserts.push({ post_id: post.id, media_url: url, media_type: "voice" });
      }

      if (mediaInserts.length > 0) {
        await supabase.from("post_media").insert(mediaInserts);
      }

      toast.success("发布成功！");
      setNewContent("");
      setSelectedImages([]);
      setImagePreviews([]);
      setVoiceFile(null);
      setShowCreate(false);
      fetchPosts();
    } catch (error: any) {
      toast.error(error.message || "发布失败");
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (postId: string) => {
    if (!user) { navigate("/auth"); return; }
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    if (post.liked_by_me) {
      await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("likes").insert({ user_id: user.id, post_id: postId });
    }
    fetchPosts();
  };

  const loadComments = async (postId: string) => {
    const { data } = await supabase
      .from("comments")
      .select("id, content, created_at, user_id")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (data) {
      const enriched = await Promise.all(
        data.map(async (c) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("user_id", c.user_id)
            .single();
          return { ...c, profiles: profile };
        })
      );
      setComments((prev) => ({ ...prev, [postId]: enriched }));
    }
  };

  const toggleComments = (postId: string) => {
    if (expandedComments === postId) {
      setExpandedComments(null);
    } else {
      setExpandedComments(postId);
      loadComments(postId);
    }
    setCommentText("");
  };

  const submitComment = async (postId: string) => {
    if (!user) { navigate("/auth"); return; }
    if (!commentText.trim()) return;

    await supabase.from("comments").insert({
      user_id: user.id,
      post_id: postId,
      content: commentText.trim(),
    });
    setCommentText("");
    loadComments(postId);
    fetchPosts();
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐾</span>
            <span className="font-extrabold text-lg text-foreground">宠物社区</span>
          </div>
          {user ? (
            <Button size="sm" variant="hero" className="rounded-full gap-1" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" /> 发帖
            </Button>
          ) : (
            <Button size="sm" variant="warm" className="rounded-full gap-1" onClick={() => navigate("/auth")}>
              <LogIn className="w-4 h-4" /> 登录
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto">
        {/* Create Post Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 bg-foreground/50 flex items-end sm:items-center justify-center">
            <div className="bg-background w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto animate-fade-in-up">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-extrabold text-lg text-foreground">发布动态</h3>
                <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-secondary">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="分享你和毛孩子的故事..."
                rows={4}
                className="w-full p-3 rounded-xl bg-secondary text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary resize-none"
              />

              {/* Image Previews */}
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 bg-foreground/60 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3 text-background" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Voice indicator */}
              {voiceFile && (
                <div className="mt-3 flex items-center gap-2 bg-secondary rounded-xl p-3">
                  <Mic className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground">语音已录制</span>
                  <button onClick={() => setVoiceFile(null)} className="ml-auto">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-secondary text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <ImageIcon className="w-4 h-4 text-primary" /> 图片
                </button>
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={cn(
                    "flex items-center gap-1 px-3 py-2 rounded-xl text-sm transition-colors",
                    isRecording
                      ? "bg-destructive text-destructive-foreground animate-pulse"
                      : "bg-secondary text-foreground hover:bg-muted"
                  )}
                >
                  <Mic className="w-4 h-4" /> {isRecording ? "停止录音" : "语音"}
                </button>
                <Button
                  variant="hero"
                  size="sm"
                  className="ml-auto rounded-xl gap-1"
                  onClick={handlePost}
                  disabled={posting}
                >
                  <Send className="w-4 h-4" /> {posting ? "发布中..." : "发布"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Posts Feed */}
        <div className="px-4 pt-4 space-y-4">
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
            posts.map((post) => (
              <article key={post.id} className="bg-card rounded-2xl p-4 card-shadow animate-fade-in-up">
                {/* Author */}
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={post.profiles?.avatar_url} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                      {(post.profiles?.username || "宠")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-sm text-foreground">{post.profiles?.username || "宠物主人"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: zhCN })}
                    </p>
                  </div>
                </div>

                {/* Content */}
                {post.content && <p className="text-sm text-foreground mb-3 leading-relaxed">{post.content}</p>}

                {/* Media */}
                {post.media.length > 0 && (
                  <div className={cn(
                    "grid gap-1.5 mb-3 rounded-xl overflow-hidden",
                    post.media.filter((m) => m.media_type === "image").length === 1 ? "grid-cols-1" :
                    post.media.filter((m) => m.media_type === "image").length === 2 ? "grid-cols-2" : "grid-cols-3"
                  )}>
                    {post.media
                      .filter((m) => m.media_type === "image")
                      .map((m) => (
                        <img key={m.id} src={m.media_url} alt="" className="w-full aspect-square object-cover rounded-lg" />
                      ))}
                  </div>
                )}

                {post.media.filter((m) => m.media_type === "voice").map((m) => (
                  <div key={m.id} className="mb-3">
                    <audio controls className="w-full h-10" src={m.media_url} />
                  </div>
                ))}

                {/* Actions */}
                <div className="flex items-center gap-6 pt-2 border-t border-border/50">
                  <button
                    onClick={() => toggleLike(post.id)}
                    className={cn(
                      "flex items-center gap-1.5 text-sm transition-colors",
                      post.liked_by_me ? "text-destructive" : "text-muted-foreground hover:text-destructive"
                    )}
                  >
                    <Heart className={cn("w-4 h-4", post.liked_by_me && "fill-current")} />
                    {post.likes_count || ""}
                  </button>
                  <button
                    onClick={() => toggleComments(post.id)}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {post.comments_count || ""}
                  </button>
                </div>

                {/* Comments Section */}
                {expandedComments === post.id && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                    {(comments[post.id] || []).map((c: any) => (
                      <div key={c.id} className="flex gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={c.profiles?.avatar_url} />
                          <AvatarFallback className="bg-secondary text-xs">
                            {(c.profiles?.username || "宠")[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs">
                            <span className="font-bold text-foreground">{c.profiles?.username || "宠物主人"}</span>
                            <span className="text-muted-foreground ml-2">
                              {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: zhCN })}
                            </span>
                          </p>
                          <p className="text-sm text-foreground mt-0.5">{c.content}</p>
                        </div>
                      </div>
                    ))}

                    {user && (
                      <div className="flex gap-2">
                        <Input
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="写评论..."
                          className="text-sm h-9"
                          onKeyDown={(e) => e.key === "Enter" && submitComment(post.id)}
                        />
                        <Button size="sm" variant="hero" className="h-9 rounded-xl" onClick={() => submitComment(post.id)}>
                          <Send className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default CommunityPage;
