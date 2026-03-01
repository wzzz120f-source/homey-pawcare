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
import { Camera, Edit3, LogOut, Heart, MessageCircle, Settings } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface Profile {
  username: string;
  avatar_url: string | null;
  bio: string | null;
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

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
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
      .select("username, avatar_url, bio")
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

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchUserPosts();
    }
  }, [user]);

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
      {/* Header */}
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
            {/* Avatar */}
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

            {/* Info */}
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
                    <DialogHeader>
                      <DialogTitle>编辑资料</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">用户名</label>
                        <Input
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          placeholder="输入用户名"
                          maxLength={20}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">个人简介</label>
                        <Textarea
                          value={editBio}
                          onChange={(e) => setEditBio(e.target.value)}
                          placeholder="介绍一下你和你的宠物..."
                          rows={3}
                          maxLength={200}
                        />
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

          {/* Stats */}
          <div className="flex items-center gap-6 mt-5 pt-4 border-t border-border/50">
            <div className="text-center">
              <p className="text-lg font-extrabold text-foreground">{posts.length}</p>
              <p className="text-xs text-muted-foreground">动态</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-extrabold text-foreground">
                {posts.reduce((sum, p) => sum + p.likes_count, 0)}
              </p>
              <p className="text-xs text-muted-foreground">获赞</p>
            </div>
          </div>
        </div>

        {/* User Posts */}
        <div className="mt-6">
          <h3 className="font-extrabold text-base text-foreground mb-4">我的动态</h3>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <span className="text-3xl block mb-2">📝</span>
              <p className="text-sm">还没有动态，去社区发一条吧！</p>
              <Button variant="hero" size="sm" className="mt-4 rounded-xl" onClick={() => navigate("/community")}>
                去发帖
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <article key={post.id} className="bg-card rounded-2xl p-4 card-shadow animate-fade-in-up">
                  {post.content && <p className="text-sm text-foreground leading-relaxed">{post.content}</p>}

                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {post.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">#{tag}</Badge>
                      ))}
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

                  {post.media.filter((m) => m.media_type === "voice").map((m) => (
                    <div key={m.id} className="mt-3">
                      <audio controls className="w-full h-10" src={m.media_url} />
                    </div>
                  ))}

                  <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border/50 text-muted-foreground text-xs">
                    <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {post.likes_count}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {post.comments_count}</span>
                    <span className="ml-auto">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: zhCN })}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default ProfilePage;
