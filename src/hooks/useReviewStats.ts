import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductReviewStat {
  product_id: string;
  avg_rating: number;
  review_count: number;
  good_review_count: number;
  good_rate: number;
}

/**
 * Aggregated good-review stats per product, used for "good-review push" sorting.
 * 推流权重 = 好评数 * 0.7 + 销量 * 0.3 (销量在调用方组合)
 */
export function useProductReviewStats() {
  return useQuery<Record<string, ProductReviewStat>>({
    queryKey: ["product-review-stats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_product_review_stats");
      if (error) throw error;
      const map: Record<string, ProductReviewStat> = {};
      (data || []).forEach((row: any) => {
        map[row.product_id] = {
          product_id: row.product_id,
          avg_rating: Number(row.avg_rating) || 0,
          review_count: Number(row.review_count) || 0,
          good_review_count: Number(row.good_review_count) || 0,
          good_rate: Number(row.good_rate) || 0,
        };
      });
      return map;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * 综合推流分数：好评数加权 + 销量/评价数兜底
 * - 有真实好评：good_count * 0.7 + sales * 0.3
 * - 无真实好评：sales （保留原排序）
 */
export function getRecommendScore(
  stat: ProductReviewStat | undefined,
  salesCount: number,
): number {
  if (!stat || stat.review_count === 0) return salesCount;
  return stat.good_review_count * 0.7 + salesCount * 0.3;
}
