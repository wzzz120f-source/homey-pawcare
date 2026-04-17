import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { UserBadge } from "@/components/community/UserBadgeChip";

/**
 * 批量加载多个用户的勋章映射
 */
export const useUserBadges = (userIds: string[]) => {
  const [badgeMap, setBadgeMap] = useState<Record<string, UserBadge[]>>({});

  useEffect(() => {
    if (userIds.length === 0) {
      setBadgeMap({});
      return;
    }
    const uniqueIds = Array.from(new Set(userIds));
    (async () => {
      const { data } = await supabase
        .from("user_badges")
        .select("user_id, badge_code, badge_name, badge_icon, badge_level")
        .in("user_id", uniqueIds);

      if (!data) return;
      const map: Record<string, UserBadge[]> = {};
      for (const row of data as any[]) {
        if (!map[row.user_id]) map[row.user_id] = [];
        map[row.user_id].push({
          badge_code: row.badge_code,
          badge_name: row.badge_name,
          badge_icon: row.badge_icon,
          badge_level: row.badge_level,
        });
      }
      setBadgeMap(map);
    })();
  }, [userIds.join(",")]);

  return badgeMap;
};

/**
 * 自动授予勋章（系统规则）：
 * - 发帖数 >= 5 → 知识分享者（bronze）
 * - 发帖数 >= 20 → 养宠达人（silver）
 * - 救助记录 >= 1 → 救助先锋（gold）
 */
export async function tryAutoAwardBadges(userId: string) {
  const [{ count: postsCount }, { count: rescueCount }, { data: existing }] = await Promise.all([
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("rescue_stories").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("user_badges").select("badge_code").eq("user_id", userId),
  ]);

  const have = new Set((existing || []).map((b: any) => b.badge_code));
  const inserts: any[] = [];

  if ((postsCount ?? 0) >= 5 && !have.has("knowledge_sharer")) {
    inserts.push({ user_id: userId, badge_code: "knowledge_sharer", badge_name: "知识分享者", badge_icon: "📚", badge_level: "bronze", awarded_by: "system" });
  }
  if ((postsCount ?? 0) >= 20 && !have.has("pet_expert")) {
    inserts.push({ user_id: userId, badge_code: "pet_expert", badge_name: "养宠达人", badge_icon: "🌟", badge_level: "silver", awarded_by: "system" });
  }
  if ((rescueCount ?? 0) >= 1 && !have.has("rescue_pioneer")) {
    inserts.push({ user_id: userId, badge_code: "rescue_pioneer", badge_name: "救助先锋", badge_icon: "❤️‍🩹", badge_level: "gold", awarded_by: "system" });
  }

  if (inserts.length > 0) {
    await supabase.from("user_badges").insert(inserts);
  }
}
