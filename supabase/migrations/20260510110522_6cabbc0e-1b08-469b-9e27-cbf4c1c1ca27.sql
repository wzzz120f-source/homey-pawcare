-- AI 客服每日限额
CREATE TABLE IF NOT EXISTS public.ai_chat_quota (
  user_id uuid NOT NULL,
  quota_date date NOT NULL DEFAULT current_date,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, quota_date)
);

ALTER TABLE public.ai_chat_quota ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "self read quota" ON public.ai_chat_quota;
CREATE POLICY "self read quota" ON public.ai_chat_quota
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 仅 service role 写入（edge function 通过 service role）
DROP POLICY IF EXISTS "service write quota" ON public.ai_chat_quota;

CREATE OR REPLACE FUNCTION public.increment_ai_chat_quota(_uid uuid, _max integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _cnt integer;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'unauthorized'); END IF;
  INSERT INTO public.ai_chat_quota(user_id, quota_date, count)
    VALUES (_uid, current_date, 1)
    ON CONFLICT (user_id, quota_date) DO UPDATE
      SET count = public.ai_chat_quota.count + 1, updated_at = now()
    RETURNING count INTO _cnt;
  IF _cnt > _max THEN
    -- 回滚本次自增并返回限流
    UPDATE public.ai_chat_quota SET count = count - 1, updated_at = now()
      WHERE user_id = _uid AND quota_date = current_date;
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited', 'count', _cnt - 1, 'max', _max);
  END IF;
  RETURN jsonb_build_object('ok', true, 'count', _cnt, 'max', _max);
END $$;