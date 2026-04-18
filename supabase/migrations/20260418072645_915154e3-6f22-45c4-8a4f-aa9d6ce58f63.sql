-- Add threading and mentions to comments
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reply_to_user_id UUID,
  ADD COLUMN IF NOT EXISTS reply_to_username TEXT,
  ADD COLUMN IF NOT EXISTS mentioned_user_ids UUID[] DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS idx_comments_post_parent ON public.comments(post_id, parent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.comments(parent_id);

-- Notifications when mentioned or replied to
CREATE OR REPLACE FUNCTION public.notify_comment_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mention UUID;
  _post_owner UUID;
  _commenter_name TEXT;
BEGIN
  SELECT username INTO _commenter_name FROM profiles WHERE user_id = NEW.user_id;

  -- Reply notification
  IF NEW.parent_id IS NOT NULL AND NEW.reply_to_user_id IS NOT NULL AND NEW.reply_to_user_id <> NEW.user_id THEN
    INSERT INTO notifications(user_id, title, content, type, related_id)
    VALUES (NEW.reply_to_user_id, '有人回复了你', COALESCE(_commenter_name,'有人') || '：' || LEFT(NEW.content, 50), 'comment', NEW.post_id::text);
  END IF;

  -- Mention notifications
  IF NEW.mentioned_user_ids IS NOT NULL THEN
    FOREACH _mention IN ARRAY NEW.mentioned_user_ids LOOP
      IF _mention <> NEW.user_id AND _mention <> COALESCE(NEW.reply_to_user_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO notifications(user_id, title, content, type, related_id)
        VALUES (_mention, '有人@了你', COALESCE(_commenter_name,'有人') || '：' || LEFT(NEW.content, 50), 'mention', NEW.post_id::text);
      END IF;
    END LOOP;
  END IF;

  -- Post owner notification (only on top-level)
  IF NEW.parent_id IS NULL THEN
    SELECT user_id INTO _post_owner FROM posts WHERE id = NEW.post_id;
    IF _post_owner IS NOT NULL AND _post_owner <> NEW.user_id THEN
      INSERT INTO notifications(user_id, title, content, type, related_id)
      VALUES (_post_owner, '收到新评论', COALESCE(_commenter_name,'有人') || '：' || LEFT(NEW.content, 50), 'comment', NEW.post_id::text);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_comment_mentions ON public.comments;
CREATE TRIGGER trg_notify_comment_mentions
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment_mentions();