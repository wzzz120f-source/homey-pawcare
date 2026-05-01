import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SafetyBadge {
  id: string;
  code: string;
  title: string;
  title_en: string | null;
  description: string;
  description_en: string | null;
  icon: string;
  sort_order: number;
}

export interface TechnicianStat {
  id: string;
  technician_code: string;
  display_name: string;
  level: string; // bronze / silver / gold / platinum / diamond
  total_services: number;
  avg_rating: number;
  review_count: number;
  years_of_experience: number;
  insurance_no: string | null;
  certifications: string[];
  bio: string | null;
}

/** 五重安全保障（全局公开） */
export function useSafetyBadges() {
  return useQuery<SafetyBadge[]>({
    queryKey: ["safety_badges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("safety_badges" as any)
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SafetyBadge[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export interface TechnicianReview {
  id: string;
  technician_code: string;
  reviewer_name: string;
  reviewer_avatar: string | null;
  rating: number;
  service_type: string;
  content: string;
  technician_level: string;
  created_at: string;
}

/** 最近评价：可按等级过滤 + 分页加载更多 */
export function useTechnicianReviews(
  technicianCode?: string | null,
  level: string = "all",
  limit: number = 5,
) {
  return useQuery<TechnicianReview[]>({
    queryKey: ["technician_reviews", technicianCode, level, limit],
    enabled: !!technicianCode,
    queryFn: async () => {
      if (!technicianCode) return [];
      let q = supabase
        .from("technician_reviews" as any)
        .select("*")
        .eq("technician_code", technicianCode)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (level && level !== "all") {
        q = q.eq("technician_level", level);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as TechnicianReview[];
    },
    staleTime: 60 * 1000,
  });
}

/** 单个宠托师统计：通过 technician_code 关联前端 services.ts 中的 id */
export function useTechnicianStat(technicianCode?: string | null) {
  return useQuery<TechnicianStat | null>({
    queryKey: ["technician_stat", technicianCode],
    enabled: !!technicianCode,
    queryFn: async () => {
      if (!technicianCode) return null;
      const { data, error } = await supabase
        .from("technician_stats" as any)
        .select("*")
        .eq("technician_code", technicianCode)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as TechnicianStat) || null;
    },
    staleTime: 5 * 60 * 1000,
  });
}
