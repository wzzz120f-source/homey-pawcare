CREATE OR REPLACE FUNCTION public.grant_points_on_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _author UUID;
  _today DATE := CURRENT_DATE;
  _earned INTEGER := 0;
  _cap INTEGER := 100;
  _grant INTEGER;
  _points INTEGER := 2;
BEGIN
  SELECT user_id INTO _author FROM posts WHERE id = NEW.post_id;
  IF _author IS NULL OR _author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO daily_point_caps(user_id, cap_date, points_earned)
    VALUES (_author, _today, 0)
    ON CONFLICT (user_id, cap_date) DO NOTHING;
  SELECT points_earned INTO _earned FROM daily_point_caps WHERE user_id = _author AND cap_date = _today;
  _grant := LEAST(_points, GREATEST(_cap - _earned, 0));
  IF _grant <= 0 THEN RETURN NEW; END IF;

  UPDATE daily_point_caps SET points_earned = points_earned + _grant
    WHERE user_id = _author AND cap_date = _today;
  UPDATE profiles SET love_points = love_points + _grant WHERE user_id = _author;
  INSERT INTO love_point_transactions(user_id, action_type, points, related_type, related_id, description)
    VALUES (_author, 'post_liked', _grant, 'post', NEW.post_id::text, '动态被点赞');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_points_on_like ON public.likes;
CREATE TRIGGER trg_grant_points_on_like
  AFTER INSERT ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_points_on_like();