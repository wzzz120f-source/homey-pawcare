
-- ============== 1. cloud_feeding 扩列 ==============
ALTER TABLE public.cloud_feeding
  ADD COLUMN IF NOT EXISTS amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'wallet';

CREATE INDEX IF NOT EXISTS idx_cloud_feeding_story_paid
  ON public.cloud_feeding (rescue_story_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_cloud_feeding_recipient
  ON public.cloud_feeding (recipient_user_id, paid_at DESC);

-- ============== 2. rescue_stories 累计金额 ==============
ALTER TABLE public.rescue_stories
  ADD COLUMN IF NOT EXISTS total_feed_amount NUMERIC NOT NULL DEFAULT 0;

-- ============== 3. RPC: 钱包投喂（原子化）==============
CREATE OR REPLACE FUNCTION public.feed_rescue_with_balance(
  _story_id UUID,
  _amount NUMERIC,
  _message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _recipient UUID;
  _is_active BOOLEAN;
  _feeder_bal NUMERIC;
  _feeder_new NUMERIC;
  _recipient_new NUMERIC;
  _feed_id UUID;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  IF _amount > 9999 THEN
    RETURN jsonb_build_object('success', false, 'error', 'amount_too_large');
  END IF;

  SELECT user_id, is_active INTO _recipient, _is_active
  FROM public.rescue_stories WHERE id = _story_id;

  IF _recipient IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'story_not_found');
  END IF;

  IF NOT _is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'story_inactive');
  END IF;

  IF _recipient = _uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'self_feed_forbidden');
  END IF;

  -- 1) 锁定并扣减投喂者钱包
  SELECT balance INTO _feeder_bal
  FROM public.user_wallets
  WHERE user_id = _uid
  FOR UPDATE;

  IF NOT FOUND OR _feeder_bal < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance');
  END IF;

  UPDATE public.user_wallets
  SET balance = balance - _amount, updated_at = now()
  WHERE user_id = _uid
  RETURNING balance INTO _feeder_new;

  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, description)
  VALUES (_uid, 'feed_out', -_amount, _feeder_new, '云投喂救助：' || COALESCE(_message, ''));

  -- 2) 给救助者钱包加款
  INSERT INTO public.user_wallets(user_id, balance)
  VALUES (_recipient, _amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.user_wallets.balance + EXCLUDED.balance,
        updated_at = now()
  RETURNING balance INTO _recipient_new;

  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, description)
  VALUES (_recipient, 'feed_in', _amount, _recipient_new, '收到爱心投喂');

  -- 3) 写 cloud_feeding 流水（金额 + 收款人 + 已到账）
  INSERT INTO public.cloud_feeding(
    rescue_story_id, user_id, recipient_user_id,
    amount, points, message, status, paid_at, channel
  )
  VALUES (
    _story_id, _uid, _recipient,
    _amount,
    GREATEST(1, FLOOR(_amount)::INT),
    _message,
    'paid', now(), 'wallet'
  )
  RETURNING id INTO _feed_id;

  -- 4) 累计救助故事
  UPDATE public.rescue_stories
  SET cloud_feed_count = COALESCE(cloud_feed_count, 0) + 1,
      cloud_feed_points = COALESCE(cloud_feed_points, 0) + GREATEST(1, FLOOR(_amount)::INT),
      total_feed_amount = COALESCE(total_feed_amount, 0) + _amount,
      updated_at = now()
  WHERE id = _story_id;

  -- 5) 通知救助者
  INSERT INTO public.notifications(user_id, type, title, content, related_id)
  VALUES (
    _recipient,
    'feed',
    '收到爱心投喂',
    '有爱心人士向你投喂 ¥' || _amount::TEXT || '，已到账钱包',
    _story_id::TEXT
  );

  RETURN jsonb_build_object(
    'success', true,
    'feed_id', _feed_id,
    'feeder_balance', _feeder_new,
    'amount', _amount
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.feed_rescue_with_balance(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.feed_rescue_with_balance(UUID, NUMERIC, TEXT) TO authenticated;

-- ============== 4. 投喂榜 ==============
CREATE OR REPLACE FUNCTION public.get_rescue_feed_top(_story_id UUID, _limit INT DEFAULT 10)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  total_amount NUMERIC,
  feed_count BIGINT,
  last_paid_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    f.user_id,
    pr.username,
    pr.avatar_url,
    SUM(f.amount) AS total_amount,
    COUNT(*) AS feed_count,
    MAX(f.paid_at) AS last_paid_at
  FROM public.cloud_feeding f
  LEFT JOIN public.profiles pr ON pr.user_id = f.user_id
  WHERE f.rescue_story_id = _story_id
    AND f.status = 'paid'
    AND f.amount > 0
  GROUP BY f.user_id, pr.username, pr.avatar_url
  ORDER BY total_amount DESC, last_paid_at DESC
  LIMIT GREATEST(_limit, 1);
$$;

REVOKE EXECUTE ON FUNCTION public.get_rescue_feed_top(UUID, INT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_rescue_feed_top(UUID, INT) TO authenticated, anon;
