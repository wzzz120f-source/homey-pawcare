
CREATE OR REPLACE FUNCTION public.get_rescue_feed_list(
  _story_id uuid,
  _limit integer DEFAULT 20,
  _before timestamptz DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  amount numeric,
  message text,
  paid_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id, f.user_id, pr.username, pr.avatar_url,
         f.amount, f.message, f.paid_at
  FROM public.cloud_feeding f
  LEFT JOIN public.profiles pr ON pr.user_id = f.user_id
  WHERE f.rescue_story_id = _story_id
    AND f.status = 'paid'
    AND f.amount > 0
    AND (_before IS NULL OR f.paid_at < _before)
  ORDER BY f.paid_at DESC NULLS LAST
  LIMIT GREATEST(LEAST(_limit, 100), 1);
$$;
