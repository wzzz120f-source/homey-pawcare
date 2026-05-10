
-- ============ 1. payments 支付单 ============
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('stripe','wechat','alipay','wallet','mock')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'CNY',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','refunded','closed')),
  channel_txn_id text,
  idempotency_key text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  expire_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  paid_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, channel)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_channel_txn ON public.payments(channel, channel_txn_id) WHERE channel_txn_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status, expire_at);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_self_or_admin_select ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 2. payment_refunds 退款单 ============
CREATE TABLE IF NOT EXISTS public.payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text,
  refund_type text NOT NULL DEFAULT 'manual' CHECK (refund_type IN ('auto','manual')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','succeeded','failed')),
  channel_refund_id text,
  operator_id uuid,
  operator_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON public.payment_refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.payment_refunds(status, created_at DESC);

ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY refunds_self_or_admin_select ON public.payment_refunds FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin')
         OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = payment_refunds.order_id AND o.driver_id = auth.uid()));

CREATE TRIGGER trg_refunds_updated_at BEFORE UPDATE ON public.payment_refunds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 3. orders 增加字段 ============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_expire_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'none'
    CHECK (refund_status IN ('none','requested','approved','rejected','refunded')),
  ADD COLUMN IF NOT EXISTS is_physical boolean NOT NULL DEFAULT false;

-- ============ 4. create_payment_intent ============
CREATE OR REPLACE FUNCTION public.create_payment_intent(_order_id uuid, _channel text, _idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _o RECORD; _p RECORD;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','unauthorized'); END IF;
  IF _channel NOT IN ('stripe','wechat','alipay','wallet','mock') THEN
    RETURN jsonb_build_object('success',false,'error','invalid_channel'); END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _order_id AND user_id = _uid;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','order_not_found'); END IF;
  IF _o.payment_status = 'paid' THEN RETURN jsonb_build_object('success',false,'error','already_paid'); END IF;
  IF _o.total_amount <= 0 THEN RETURN jsonb_build_object('success',false,'error','invalid_amount'); END IF;

  -- 复用未过期的同渠道支付单（幂等）
  SELECT * INTO _p FROM public.payments
    WHERE order_id = _order_id AND channel = _channel
    ORDER BY created_at DESC LIMIT 1;
  IF FOUND AND _p.status = 'pending' AND _p.expire_at > now() THEN
    RETURN jsonb_build_object('success',true,'payment_id',_p.id,'reused',true,'expire_at',_p.expire_at);
  END IF;
  IF FOUND AND _p.status = 'pending' THEN
    UPDATE public.payments SET status='closed', closed_at=now() WHERE id = _p.id;
  END IF;

  INSERT INTO public.payments(order_id, user_id, channel, amount, idempotency_key)
    VALUES (_order_id, _uid, _channel, _o.total_amount, _idempotency_key)
    RETURNING * INTO _p;

  UPDATE public.orders
    SET payment_id = _p.id, payment_method = _channel, payment_expire_at = _p.expire_at, updated_at = now()
    WHERE id = _order_id;

  RETURN jsonb_build_object('success',true,'payment_id',_p.id,'amount',_p.amount,'expire_at',_p.expire_at,'reused',false);
END $$;

-- ============ 5. mark_payment_succeeded ============
CREATE OR REPLACE FUNCTION public.mark_payment_succeeded(_payment_id uuid, _channel_txn_id text, _amount numeric, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p RECORD; _new_bal numeric;
BEGIN
  SELECT * INTO _p FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF _p.status = 'succeeded' THEN RETURN jsonb_build_object('success',true,'idempotent',true); END IF;
  IF _p.status NOT IN ('pending') THEN RETURN jsonb_build_object('success',false,'error','invalid_state','state',_p.status); END IF;
  IF abs(_p.amount - _amount) > 0.01 THEN RETURN jsonb_build_object('success',false,'error','amount_mismatch'); END IF;

  UPDATE public.payments
    SET status='succeeded', channel_txn_id = COALESCE(_channel_txn_id, channel_txn_id),
        raw_payload = _payload, paid_at = now(), updated_at = now()
    WHERE id = _payment_id;

  UPDATE public.orders
    SET payment_status = 'paid',
        order_status = CASE WHEN order_status IN ('created','pending') THEN 'confirmed' ELSE order_status END,
        updated_at = now()
    WHERE id = _p.order_id;

  -- 钱包渠道：扣减余额并写流水
  IF _p.channel = 'wallet' THEN
    UPDATE public.user_wallets SET balance = balance - _p.amount, updated_at = now()
      WHERE user_id = _p.user_id RETURNING balance INTO _new_bal;
    INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, related_order_id, description)
      VALUES (_p.user_id, 'pay', -_p.amount, COALESCE(_new_bal,0), _p.order_id, '钱包支付');
  END IF;

  RETURN jsonb_build_object('success',true);
END $$;

-- ============ 6. mark_payment_failed ============
CREATE OR REPLACE FUNCTION public.mark_payment_failed(_payment_id uuid, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.payments SET status='failed', raw_payload=_payload, updated_at=now()
    WHERE id = _payment_id AND status = 'pending';
  RETURN jsonb_build_object('success',true);
END $$;

-- ============ 7. request_refund ============
CREATE OR REPLACE FUNCTION public.request_refund(_order_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _o RECORD; _p RECORD; _rid uuid; _rtype text;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','unauthorized'); END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND OR _o.user_id <> _uid THEN RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;
  IF _o.payment_status <> 'paid' THEN RETURN jsonb_build_object('success',false,'error','not_paid'); END IF;
  IF _o.refund_status NOT IN ('none','rejected') THEN RETURN jsonb_build_object('success',false,'error','already_requested'); END IF;
  SELECT * INTO _p FROM public.payments WHERE id = _o.payment_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','no_payment'); END IF;

  -- 实物订单走人工，虚拟订单走自动（pending → 等服务商/admin 处理）
  _rtype := CASE WHEN _o.is_physical THEN 'manual' ELSE 'auto' END;

  INSERT INTO public.payment_refunds(payment_id, order_id, user_id, amount, reason, refund_type)
    VALUES (_p.id, _order_id, _uid, _p.amount, _reason, _rtype)
    RETURNING id INTO _rid;
  UPDATE public.orders SET refund_status = 'requested', updated_at = now() WHERE id = _order_id;
  RETURN jsonb_build_object('success',true,'refund_id',_rid,'refund_type',_rtype);
END $$;

-- ============ 8. process_refund (服务商/admin 通过 / 拒绝 / 完成) ============
CREATE OR REPLACE FUNCTION public.process_refund(_refund_id uuid, _action text, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _r RECORD; _o RECORD; _p RECORD; _new_bal numeric; _is_provider boolean; _is_admin boolean;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','unauthorized'); END IF;
  IF _action NOT IN ('approve','reject') THEN RETURN jsonb_build_object('success',false,'error','invalid_action'); END IF;
  SELECT * INTO _r FROM public.payment_refunds WHERE id = _refund_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF _r.status <> 'pending' THEN RETURN jsonb_build_object('success',false,'error','already_processed'); END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _r.order_id;
  SELECT * INTO _p FROM public.payments WHERE id = _r.payment_id;

  _is_admin := has_role(_uid,'admin');
  _is_provider := (_o.driver_id = _uid);
  -- 虚拟订单：服务商或 admin 都可处理；实物订单：仅 admin
  IF _o.is_physical AND NOT _is_admin THEN RETURN jsonb_build_object('success',false,'error','admin_only'); END IF;
  IF NOT _o.is_physical AND NOT (_is_admin OR _is_provider) THEN RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;

  IF _action = 'reject' THEN
    UPDATE public.payment_refunds SET status='rejected', operator_id=_uid, operator_note=_note, updated_at=now() WHERE id=_refund_id;
    UPDATE public.orders SET refund_status='rejected', updated_at=now() WHERE id=_o.id;
    INSERT INTO public.notifications(user_id,title,content,type,related_id)
      VALUES (_r.user_id,'退款申请被拒绝',COALESCE(_note,'请联系客服了解详情'),'order',_o.id::text);
    RETURN jsonb_build_object('success',true,'status','rejected');
  END IF;

  -- approve：标记待退款，钱包渠道立即原路退；其他渠道（stripe/微信/支付宝）由后端 Edge Function 调渠道接口后再调一次本函数 + action='succeeded'
  -- 这里采用一步到位：approve 即视为退款成功（mock/wallet）；非 wallet 由 Edge Function 在调完渠道接口后再 UPDATE payment_refunds.status='succeeded'
  IF _p.channel = 'wallet' OR _p.channel = 'mock' THEN
    UPDATE public.user_wallets SET balance = balance + _r.amount, updated_at = now()
      WHERE user_id = _r.user_id RETURNING balance INTO _new_bal;
    IF _new_bal IS NULL THEN
      INSERT INTO public.user_wallets(user_id, balance) VALUES (_r.user_id, _r.amount) RETURNING balance INTO _new_bal;
    END IF;
    INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, related_order_id, description)
      VALUES (_r.user_id, 'refund', _r.amount, _new_bal, _o.id, COALESCE(_r.reason,'订单退款'));
    UPDATE public.payment_refunds SET status='succeeded', operator_id=_uid, operator_note=_note, updated_at=now() WHERE id=_refund_id;
    UPDATE public.payments SET status='refunded', updated_at=now() WHERE id=_p.id;
    UPDATE public.orders SET refund_status='refunded', payment_status='refunded', updated_at=now() WHERE id=_o.id;
  ELSE
    -- 非钱包渠道：标记 approved，由 Edge Function refund-payment 调渠道接口完成
    UPDATE public.payment_refunds SET status='approved', operator_id=_uid, operator_note=_note, updated_at=now() WHERE id=_refund_id;
    UPDATE public.orders SET refund_status='approved', updated_at=now() WHERE id=_o.id;
  END IF;

  INSERT INTO public.notifications(user_id,title,content,type,related_id)
    VALUES (_r.user_id,'退款申请已通过','金额 '|| _r.amount ||' 元正在处理','order',_o.id::text);
  RETURN jsonb_build_object('success',true,'status','approved','channel',_p.channel);
END $$;

-- ============ 9. close_expired_payments（由 Edge Function / pg_cron 定时调用） ============
CREATE OR REPLACE FUNCTION public.close_expired_payments()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  WITH upd AS (
    UPDATE public.payments SET status='closed', closed_at=now(), updated_at=now()
      WHERE status='pending' AND expire_at < now()
      RETURNING 1
  ) SELECT count(*) INTO _n FROM upd;
  RETURN _n;
END $$;
