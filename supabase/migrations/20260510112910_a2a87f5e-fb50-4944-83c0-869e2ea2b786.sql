
CREATE OR REPLACE FUNCTION public.get_feed_posts(
  _viewer UUID DEFAULT NULL,
  _category TEXT DEFAULT NULL,
  _tag TEXT DEFAULT NULL,
  _search TEXT DEFAULT NULL,
  _limit INT DEFAULT 50,
  _offset INT DEFAULT 0
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
  ORDER BY p.is_featured DESC NULLS LAST, p.created_at DESC
  LIMIT GREATEST(_limit, 1) OFFSET GREATEST(_offset, 0);
$$;
