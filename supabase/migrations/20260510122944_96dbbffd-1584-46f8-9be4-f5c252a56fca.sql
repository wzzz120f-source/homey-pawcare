
-- 1) 字段
ALTER TABLE public.rescue_stories
  ADD COLUMN IF NOT EXISTS verify_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verify_note   text,
  ADD COLUMN IF NOT EXISTS real_name     text,
  ADD COLUMN IF NOT EXISTS id_card_last4 text,
  ADD COLUMN IF NOT EXISTS proof_urls    text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS verified_by   uuid,
  ADD COLUMN IF NOT EXISTS verified_at   timestamptz;

-- 历史 active 数据视为已通过，避免影响存量
UPDATE public.rescue_stories
   SET verify_status = 'verified', verified_at = COALESCE(verified_at, now())
 WHERE verify_status = 'pending' AND COALESCE(is_active, true) = true AND created_at < now();

CREATE INDEX IF NOT EXISTS idx_rescue_stories_verify ON public.rescue_stories(verify_status);

-- 2) Admin 审核 RPC
CREATE OR REPLACE FUNCTION public.admin_review_rescue_story(
  _id uuid, _approve boolean, _note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _admin uuid := auth.uid(); _s RECORD;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  SELECT * INTO _s FROM public.rescue_stories WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  UPDATE public.rescue_stories
    SET verify_status = CASE WHEN _approve THEN 'verified' ELSE 'rejected' END,
        verify_note   = _note,
        verified_by   = _admin,
        verified_at   = now(),
        updated_at    = now()
    WHERE id = _id;
  INSERT INTO public.notifications(user_id, title, content, type, related_id)
  VALUES (
    _s.user_id,
    CASE WHEN _approve THEN '救助审核已通过' ELSE '救助审核未通过' END,
    CASE WHEN _approve THEN '你发布的救助「' || _s.pet_name || '」已审核通过，可接收云投喂。'
         ELSE '审核未通过：' || COALESCE(_note, '请补充身份与证据材料后重新发布。') END,
    'rescue', _id::text
  );
  PERFORM public.log_admin_action(
    CASE WHEN _approve THEN 'rescue_story_approved' ELSE 'rescue_story_rejected' END,
    'rescue_story', _id::text, jsonb_build_object('note', _note)
  );
  RETURN jsonb_build_object('success', true);
END $$;

-- 3) 强制：未通过审核不可被投喂
CREATE OR REPLACE FUNCTION public.feed_rescue_with_balance(
  _story_id uuid, _amount numeric, _message text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _recipient UUID;
  _is_active BOOLEAN;
  _verify_status TEXT;
  _feeder_bal NUMERIC;
  _feeder_new NUMERIC;
  _recipient_new NUMERIC;
  _feed_id UUID;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_amount'); END IF;
  IF _amount > 9999 THEN RETURN jsonb_build_object('success', false, 'error', 'amount_too_large'); END IF;

  SELECT user_id, is_active, verify_status INTO _recipient, _is_active, _verify_status
    FROM public.rescue_stories WHERE id = _story_id;

  IF _recipient IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'story_not_found'); END IF;
  IF NOT _is_active THEN RETURN jsonb_build_object('success', false, 'error', 'story_inactive'); END IF;
  IF _verify_status <> 'verified' THEN RETURN jsonb_build_object('success', false, 'error', 'story_not_verified'); END IF;
  IF _recipient = _uid THEN RETURN jsonb_build_object('success', false, 'error', 'self_feed_forbidden'); END IF;

  SELECT balance INTO _feeder_bal FROM public.user_wallets WHERE user_id = _uid FOR UPDATE;
  IF NOT FOUND OR _feeder_bal < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance');
  END IF;

  UPDATE public.user_wallets SET balance = balance - _amount, updated_at = now()
    WHERE user_id = _uid RETURNING balance INTO _feeder_new;

  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, description)
  VALUES (_uid, 'feed_out', -_amount, _feeder_new, '云投喂救助：' || COALESCE(_message, ''));

  INSERT INTO public.user_wallets(user_id, balance) VALUES (_recipient, _amount)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.user_wallets.balance + EXCLUDED.balance, updated_at = now()
    RETURNING balance INTO _recipient_new;

  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, description)
  VALUES (_recipient, 'feed_in', _amount, _recipient_new, '收到爱心投喂');

  INSERT INTO public.cloud_feeding(
    rescue_story_id, user_id, recipient_user_id, amount, points, message, status, paid_at, channel
  ) VALUES (
    _story_id, _uid, _recipient, _amount,
    GREATEST(1, FLOOR(_amount)::INT), _message, 'paid', now(), 'wallet'
  ) RETURNING id INTO _feed_id;

  UPDATE public.rescue_stories
    SET cloud_feed_count  = COALESCE(cloud_feed_count, 0) + 1,
        cloud_feed_points = COALESCE(cloud_feed_points, 0) + GREATEST(1, FLOOR(_amount)::INT),
        total_feed_amount = COALESCE(total_feed_amount, 0) + _amount,
        updated_at = now()
    WHERE id = _story_id;

  INSERT INTO public.notifications(user_id, type, title, content, related_id)
  VALUES (_recipient, 'feed', '收到爱心投喂',
    '有爱心人士向你投喂 ¥' || _amount::TEXT || '，已到账钱包', _story_id::TEXT);

  RETURN jsonb_build_object('success', true, 'feed_id', _feed_id, 'feeder_balance', _feeder_new, 'amount', _amount);
END $$;
