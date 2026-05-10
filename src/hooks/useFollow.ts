import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const useFollow = (targetUserId?: string | null) => {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!targetUserId) return;
    const [{ data: stats }, follow] = await Promise.all([
      (supabase as any).rpc("get_follow_stats", { _user_id: targetUserId }).single(),
      user
        ? supabase
            .from("user_follows" as any)
            .select("id")
            .eq("follower_id", user.id)
            .eq("following_id", targetUserId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (stats) {
      setFollowersCount(Number(stats.followers_count) || 0);
      setFollowingCount(Number(stats.following_count) || 0);
    }
    setIsFollowing(!!(follow as any)?.data);
  }, [targetUserId, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(async () => {
    if (!user) {
      toast.error("请先登录");
      return;
    }
    if (!targetUserId || targetUserId === user.id) return;
    setLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("user_follows" as any)
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId);
        if (error) throw error;
        setIsFollowing(false);
        setFollowersCount((n) => Math.max(0, n - 1));
      } else {
        const { error } = await supabase
          .from("user_follows" as any)
          .insert({ follower_id: user.id, following_id: targetUserId });
        if (error) throw error;
        setIsFollowing(true);
        setFollowersCount((n) => n + 1);
        toast.success("已关注");
      }
    } catch (e: any) {
      toast.error(e?.message || "操作失败");
    } finally {
      setLoading(false);
    }
  }, [user, targetUserId, isFollowing]);

  return { isFollowing, loading, followersCount, followingCount, toggle, refresh };
};
