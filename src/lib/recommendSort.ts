import { getRecommendScore, type ProductReviewStat } from "@/hooks/useReviewStats";

export interface SortableProduct {
  id: string;
  sales_count: number;
}

/**
 * Stable "good-review push" sort for products.
 * - Primary: recommend score = good_review_count * 0.7 + sales_count * 0.3 (fallback to sales when no reviews)
 * - Tiebreaker: product id (lexicographic) — guarantees stable ordering across reviewStats arrival
 *
 * Pure function — extracted for unit testing.
 */
export function sortProductsByRecommend<T extends SortableProduct>(
  products: T[],
  reviewStats: Record<string, ProductReviewStat> | undefined,
): T[] {
  return [...products].sort((a, b) => {
    const diff =
      getRecommendScore(reviewStats?.[b.id], b.sales_count) -
      getRecommendScore(reviewStats?.[a.id], a.sales_count);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
}
