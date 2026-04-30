import { describe, it, expect } from "vitest";
import { sortProductsByRecommend } from "./recommendSort";
import type { ProductReviewStat } from "@/hooks/useReviewStats";

const mkStat = (
  product_id: string,
  good_review_count: number,
  review_count: number,
): ProductReviewStat => ({
  product_id,
  good_review_count,
  review_count,
  avg_rating: 5,
  good_rate: review_count ? (good_review_count / review_count) * 100 : 0,
});

describe("sortProductsByRecommend", () => {
  const products = [
    { id: "a", sales_count: 100 },
    { id: "b", sales_count: 50 },
    { id: "c", sales_count: 200 },
  ];

  it("falls back to sales-based ordering when reviewStats is undefined", () => {
    const r1 = sortProductsByRecommend(products, undefined).map((p) => p.id);
    expect(r1).toEqual(["c", "a", "b"]);
  });

  it("applies good-review weighting when reviewStats present", () => {
    const stats: Record<string, ProductReviewStat> = {
      // b: 50 good reviews -> 50*0.7 + 50*0.3 = 50  (lower than below)
      b: mkStat("b", 50, 60),
      // a: 200 good reviews -> 200*0.7 + 100*0.3 = 170
      a: mkStat("a", 200, 220),
      // c: 0 good but 300 reviews -> 0*0.7 + 200*0.3 = 60
      c: mkStat("c", 0, 300),
    };
    const r = sortProductsByRecommend(products, stats).map((p) => p.id);
    expect(r).toEqual(["a", "c", "b"]);
  });

  it("produces the same ordering whether stats arrive before or after (stability)", () => {
    const stats: Record<string, ProductReviewStat> = {
      a: mkStat("a", 10, 20),
      b: mkStat("b", 10, 20),
      c: mkStat("c", 10, 20),
    };
    // All have identical scores → tiebreaker (id) keeps result deterministic
    const beforeStats = sortProductsByRecommend(products, undefined);
    const afterStats = sortProductsByRecommend(products, stats);
    // After stats, equal scores → alphabetical by id
    expect(afterStats.map((p) => p.id)).toEqual(["a", "b", "c"]);
    // Re-running with same inputs is identical (no in-place mutation)
    expect(sortProductsByRecommend(products, stats).map((p) => p.id)).toEqual(
      afterStats.map((p) => p.id),
    );
    // Original input array is untouched
    expect(products.map((p) => p.id)).toEqual(["a", "b", "c"]);
    // Sanity: pre-stats result is sales-based, not random
    expect(beforeStats.map((p) => p.id)).toEqual(["c", "a", "b"]);
  });

  it("is stable across repeated runs with partial stats arriving", () => {
    const partial: Record<string, ProductReviewStat> = {
      a: mkStat("a", 100, 110),
    };
    const full: Record<string, ProductReviewStat> = {
      a: mkStat("a", 100, 110),
      b: mkStat("b", 5, 10),
      c: mkStat("c", 0, 0), // review_count 0 → fallback to sales (200)
    };
    const partialOrder = sortProductsByRecommend(products, partial).map((p) => p.id);
    const fullOrder = sortProductsByRecommend(products, full).map((p) => p.id);
    // a: 100*0.7 + 100*0.3 = 100  | c (no reviews) → sales 200 | b: 5*0.7+50*0.3=18.5
    expect(fullOrder).toEqual(["c", "a", "b"]);
    // partial: a=100, b/c fallback to sales 50/200 → c,a,b
    expect(partialOrder).toEqual(["c", "a", "b"]);
    // Same final ordering regardless of arrival timing
    expect(partialOrder).toEqual(fullOrder);
  });
});
