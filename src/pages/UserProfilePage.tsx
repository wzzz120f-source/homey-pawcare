import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, MessageCircle, UserPlus2 } from "lucide-react";
import FollowButton from "@/components/FollowButton";
import { useFollow } from "@/hooks/useFollow";
import { openDmConversation } from "@/lib/dm";
import MediaThumb from "@/components/MediaThumb";
import { toast } from "sonner";
import { friendlySupabaseError } from "@/lib/supabaseError";

interface ProfileRow {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface FeedRow {
  id: string;
  content: string;
  media: { id: string; media_url: string; media_type: string }[];
  likes_count: number;
  comments_count: number;
}

const UserProfilePage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { followersCount, followingCount } = useFollow(userId);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [posts, setPosts] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [friendStatus, setFriendStatus] = useState<"none" | "pending" | "accepted">("none");

  const isSelf = user?.id === userId;

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const [{ data: prof }, { data: feed }] = await Promise.all([
        supabase.from("profiles").select("user_id, username, avatar_url, bio").eq("user_id", userId).maybeSingle(),
        (supabase as any).rpc("get_feed_posts", {
          _viewer: user?.id ?? null,
          _category: null,
          _tag: null,
          _search: null,
          _limit: 30,
          _offset: 0,
          _only_following: false,
        }),
      ]);
      if (!mounted) return;
      setProfile(prof as any);
      setPosts(((feed as any[]) || []).filter((p) => p.user_id === userId));
      // friend status
      if (user && !isSelf) {
        const { data: fr } = await supabase
          .from("friend_requests" as any)
          .select("status")
          .or(
            `and(from_user.eq.${user.id},to_user.eq.${userId}),and(from_user.eq.${userId},to_user.eq.${user.id})`,
          )
          .in("status", ["pending", "accepted"])
          .maybeSingle();
        if ((fr as any)?.data || fr) {
          const row = (fr as any) ?? null;
          if (row?.status === "accepted") setFriendStatus("accepted");
          else if (row?.status === "pending") setFriendStatus("pending");
        }
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [userId, user, isSelf]);

  const handleDM = async () => {
    if (!user) {
      toast.error("请先登录");
      navigate("/auth");
      return;
    }
    if (!userId) return;
    try {
      const id = await openDmConversation(user.id, userId);
      navigate(`/chat/${id}`);
    } catch (e) {
      toast.error(friendlySupabaseError(e));
    }
  };

  const handleFriendRequest = async () => {
    if (!user || !userId) return;
    setRequesting(true);
    try {
      const { error } = await supabase
        .from("friend_requests" as any)
        .insert({ from_user: user.id, to_user: userId, status: "pending" });
      if (error) throw error;
      setFriendStatus("pending");
      toast.success("好友申请已发送");
    } catch (e) {
      toast.error(friendlySupabaseError(e));
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-lg mx-auto flex items-center gap-2 px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full hover:bg-secondary"
            aria-label="返回"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-extrabold text-base truncate">{profile?.username || "宠友主页"}</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ) : !profile ? (
          <div className="text-center py-20 text-muted-foreground">用户不存在</div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback>{(profile.username || "宠")[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-lg truncate">{profile.username || "宠物主人"}</div>
                <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {profile.bio || "这位宠友还没有简介～"}
                </div>
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  <span><b className="text-foreground">{followersCount}</b> 粉丝</span>
                  <span><b className="text-foreground">{followingCount}</b> 关注</span>
                  <span><b className="text-foreground">{posts.length}</b> 动态</span>
                </div>
              </div>
            </div>

            {!isSelf && (
              <div className="flex gap-2 mt-4">
                <FollowButton targetUserId={userId} className="flex-1" />
                <Button size="sm" variant="secondary" className="flex-1 rounded-full gap-1 min-h-[32px]" onClick={handleDM}>
                  <MessageCircle className="w-3.5 h-3.5" /> 私信
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 rounded-full gap-1 min-h-[32px]"
                  disabled={requesting || friendStatus !== "none"}
                  onClick={handleFriendRequest}
                >
                  <UserPlus2 className="w-3.5 h-3.5" />
                  {friendStatus === "accepted" ? "已是好友" : friendStatus === "pending" ? "申请中" : "加好友"}
                </Button>
              </div>
            )}

            <h2 className="font-bold text-sm text-foreground mt-6 mb-2">TA 的动态</h2>
            {posts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">还没有动态</div>
            ) : (
              <div className="columns-2 gap-2 [&>*]:mb-2 [&>*]:break-inside-avoid">
                {posts.map((p) => {
                  const cover = p.media?.find((m) => m.media_type !== "live_photo_video");
                  return (
                    <article
                      key={p.id}
                      onClick={() => navigate(`/post/${p.id}`)}
                      className="bg-card rounded-2xl overflow-hidden card-shadow cursor-pointer"
                    >
                      {cover && (
                        <MediaThumb url={cover.media_url} mediaType={cover.media_type} alt="" className="w-full aspect-square" videoControls={false} />
                      )}
                      <div className="p-2">
                        <p className="text-xs text-foreground line-clamp-2">{p.content}</p>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          ❤ {p.likes_count} · 💬 {p.comments_count}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default UserProfilePage;
