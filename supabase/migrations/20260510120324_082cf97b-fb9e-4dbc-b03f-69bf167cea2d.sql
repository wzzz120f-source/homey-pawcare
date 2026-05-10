
-- ============== 1. user_follows ==============
CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follows_public_read"
  ON public.user_follows FOR SELECT
  USING (true);

CREATE POLICY "follows_self_insert"
  ON public.user_follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows_self_delete"
  ON public.user_follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- ============== 2. friend_requests ==============
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user UUID NOT NULL,
  to_user UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_user <> to_user),
  CHECK (status IN ('pending','accepted','rejected','cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_friend_request_pending
  ON public.friend_requests (from_user, to_user)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON public.friend_requests(to_user, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON public.friend_requests(from_user, status);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friend_req_party_read"
  ON public.friend_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);

CREATE POLICY "friend_req_sender_insert"
  ON public.friend_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user AND status = 'pending');

CREATE POLICY "friend_req_party_update"
  ON public.friend_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user)
  WITH CHECK (auth.uid() = from_user OR auth.uid() = to_user);

-- ============== 3. update_updated_at trigger ==============
CREATE TRIGGER trg_friend_requests_updated
BEFORE UPDATE ON public.friend_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== 4. Extend get_feed_posts to support "following only" ==============
CREATE OR REPLACE FUNCTION public.get_feed_posts(
  _viewer UUID DEFAULT NULL,
  _category TEXT DEFAULT NULL,
  _tag TEXT DEFAULT NULL,
  _search TEXT DEFAULT NULL,
  _limit INT DEFAULT 50,
  _offset INT DEFAULT 0,
  _only_following BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  content TEXT,
  created_at TIMESTAMPTZ,
  tags TEXT[],
  category TEXT,
  is_featured BOOLEAN,
  username TEXT,
  avatar_url TEXT,
  media JSONB,
  likes_count BIGINT,
  comments_count BIGINT,
  liked_by_me BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.user_id, p.content, p.created_at,
    COALESCE(p.tags, '{}') AS tags,
    COALESCE(p.category, 'life') AS category,
    COALESCE(p.is_featured, false) AS is_featured,
    pr.username, pr.avatar_url,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', m.id, 'media_url', m.media_url, 'media_type', m.media_type) ORDER BY m.created_at)
      FROM public.post_media m WHERE m.post_id = p.id
    ), '[]'::jsonb) AS media,
    (SELECT count(*) FROM public.likes l WHERE l.post_id = p.id) AS likes_count,
    (SELECT count(*) FROM public.comments c WHERE c.post_id = p.id) AS comments_count,
    CASE WHEN _viewer IS NULL THEN false
      ELSE EXISTS (SELECT 1 FROM public.likes l2 WHERE l2.post_id = p.id AND l2.user_id = _viewer)
    END AS liked_by_me
  FROM public.posts p
  LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE (_category IS NULL OR _category = 'all' OR p.category = _category)
    AND (_tag IS NULL OR p.tags @> ARRAY[_tag])
    AND (_search IS NULL OR _search = '' OR p.content ILIKE '%' || _search || '%')
    AND (
      NOT _only_following
      OR (_viewer IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.user_follows uf
        WHERE uf.follower_id = _viewer AND uf.following_id = p.user_id
      ))
    )
  ORDER BY p.is_featured DESC NULLS LAST, p.created_at DESC
  LIMIT GREATEST(_limit, 1) OFFSET GREATEST(_offset, 0);
$$;

-- ============== 5. Helper: count followers / following ==============
CREATE OR REPLACE FUNCTION public.get_follow_stats(_user_id UUID)
RETURNS TABLE (followers_count BIGINT, following_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*) FROM public.user_follows WHERE following_id = _user_id),
    (SELECT count(*) FROM public.user_follows WHERE follower_id = _user_id);
$$;
