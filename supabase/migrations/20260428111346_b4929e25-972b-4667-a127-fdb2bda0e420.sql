-- Aggregate product review stats joined via order_items
CREATE OR REPLACE FUNCTION public.get_product_review_stats()
RETURNS TABLE (
  product_id uuid,
  avg_rating numeric,
  review_count bigint,
  good_review_count bigint,
  good_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    oi.product_id,
    ROUND(AVG(orv.rating)::numeric, 2) AS avg_rating,
    COUNT(*)::bigint AS review_count,
    COUNT(*) FILTER (WHERE orv.rating >= 4)::bigint AS good_review_count,
    ROUND((COUNT(*) FILTER (WHERE orv.rating >= 4)::numeric / NULLIF(COUNT(*),0)) * 100, 1) AS good_rate
  FROM public.order_reviews orv
  JOIN public.order_items oi ON oi.order_id = orv.order_id
  WHERE oi.product_id IS NOT NULL
  GROUP BY oi.product_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_review_stats() TO anon, authenticated;