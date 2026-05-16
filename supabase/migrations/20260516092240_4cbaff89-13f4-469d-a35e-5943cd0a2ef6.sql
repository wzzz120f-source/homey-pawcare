
-- Step 1: schema additions
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS provider_id uuid,
  ADD COLUMN IF NOT EXISTS provider_role public.app_role,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_provider_id_idx ON public.orders(provider_id) WHERE provider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_pending_accept_idx ON public.orders(service_type, created_at)
  WHERE provider_id IS NULL AND order_status = 'pending_accept';

-- Backfill: legacy driver_id → provider_id
UPDATE public.orders
   SET provider_id = driver_id,
       provider_role = CASE service_type
         WHEN 'groom' THEN 'groomer'::public.app_role
         WHEN 'pickup' THEN 'driver'::public.app_role
         WHEN 'delivery' THEN 'driver'::public.app_role
         ELSE 'sitter'::public.app_role END
 WHERE driver_id IS NOT NULL AND provider_id IS NULL;

-- Service orders that are paid but unassigned → pending_accept
UPDATE public.orders
   SET order_status = 'pending_accept'
 WHERE payment_status = 'paid'
   AND provider_id IS NULL
   AND COALESCE(order_type,'') = 'service'
   AND order_status IN ('created','paid','confirmed');

-- Add RLS: providers can view & update their accepted orders
DROP POLICY IF EXISTS "Providers can view assigned orders" ON public.orders;
CREATE POLICY "Providers can view assigned orders" ON public.orders
  FOR SELECT TO authenticated
  USING (provider_id = auth.uid() OR driver_id = auth.uid());

DROP POLICY IF EXISTS "Providers can view pending accept pool" ON public.orders;
CREATE POLICY "Providers can view pending accept pool" ON public.orders
  FOR SELECT TO authenticated
  USING (
    order_status = 'pending_accept' AND provider_id IS NULL
    AND (has_role(auth.uid(),'sitter') OR has_role(auth.uid(),'groomer') OR has_role(auth.uid(),'driver'))
  );

-- Step 2: worker_grab_order
CREATE OR REPLACE FUNCTION public.worker_grab_order(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _svc text; _role public.app_role; _user_id uuid; _updated int;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','unauthorized'); END IF;
  SELECT service_type, user_id INTO _svc, _user_id FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  _role := CASE _svc
    WHEN 'groom' THEN 'groomer'::public.app_role
    WHEN 'pickup' THEN 'driver'::public.app_role
    WHEN 'delivery' THEN 'driver'::public.app_role
    ELSE 'sitter'::public.app_role END;
  IF NOT public.has_role(_uid, _role) THEN
    RETURN jsonb_build_object('success',false,'error','role_mismatch','required',_role::text);
  END IF;
  UPDATE public.orders
     SET provider_id = _uid, provider_role = _role,
         driver_id = COALESCE(driver_id, _uid),
         accepted_at = now(),
         order_status = 'accepted',
         updated_at = now()
   WHERE id = _order_id AND provider_id IS NULL
     AND order_status IN ('pending_accept','pending','created','paid','confirmed');
  GET DIAGNOSTICS _updated = ROW_COUNT;
  IF _updated = 0 THEN RETURN jsonb_build_object('success',false,'error','already_taken'); END IF;
  INSERT INTO public.notifications(user_id, type, title, content, related_id)
    VALUES (_user_id, 'order', '服务者已接单', '您的订单已被服务者接受，请等待上门服务', _order_id::text);
  RETURN jsonb_build_object('success',true,'role',_role::text);
END $$;

GRANT EXECUTE ON FUNCTION public.worker_grab_order(uuid) TO authenticated;

-- worker_update_progress: accepted → on_the_way → serving
CREATE OR REPLACE FUNCTION public.worker_update_progress(_order_id uuid, _to_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _o public.orders%ROWTYPE; _allowed text[];
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','unauthorized'); END IF;
  IF _to_status NOT IN ('on_the_way','serving','awaiting_confirm') THEN
    RETURN jsonb_build_object('success',false,'error','invalid_status');
  END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF _o.provider_id <> _uid AND _o.driver_id <> _uid THEN
    RETURN jsonb_build_object('success',false,'error','forbidden');
  END IF;
  _allowed := CASE _to_status
    WHEN 'on_the_way' THEN ARRAY['accepted']
    WHEN 'serving' THEN ARRAY['accepted','on_the_way']
    WHEN 'awaiting_confirm' THEN ARRAY['serving','on_the_way','accepted']
  END;
  IF NOT (_o.order_status = ANY(_allowed)) THEN
    RETURN jsonb_build_object('success',false,'error','bad_transition','from',_o.order_status,'to',_to_status);
  END IF;
  UPDATE public.orders
     SET order_status = _to_status,
         started_at = CASE WHEN _to_status = 'serving' AND started_at IS NULL THEN now() ELSE started_at END,
         completed_at = CASE WHEN _to_status = 'awaiting_confirm' THEN now() ELSE completed_at END,
         updated_at = now()
   WHERE id = _order_id;
  -- notify consumer
  INSERT INTO public.notifications(user_id, type, title, content, related_id)
    VALUES (_o.user_id, 'order',
      CASE _to_status WHEN 'on_the_way' THEN '服务者已出发'
                      WHEN 'serving' THEN '服务进行中'
                      ELSE '请确认服务完成' END,
      CASE _to_status WHEN 'on_the_way' THEN '服务者正在赶往您的位置'
                      WHEN 'serving' THEN '服务者已开始服务，请关注打卡和照片'
                      ELSE '服务已完成，请尽快确认；48 小时后系统将自动确认结算' END,
      _order_id::text);
  RETURN jsonb_build_object('success',true,'status',_to_status);
END $$;

GRANT EXECUTE ON FUNCTION public.worker_update_progress(uuid,text) TO authenticated;

-- user_confirm_complete
CREATE OR REPLACE FUNCTION public.user_confirm_complete(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _o public.orders%ROWTYPE; _release jsonb;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','unauthorized'); END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF _o.user_id <> _uid AND NOT public.has_role(_uid,'admin') THEN
    RETURN jsonb_build_object('success',false,'error','forbidden');
  END IF;
  IF _o.order_status NOT IN ('awaiting_confirm','serving','on_the_way','accepted','completed') THEN
    RETURN jsonb_build_object('success',false,'error','bad_status','status',_o.order_status);
  END IF;
  UPDATE public.orders
     SET order_status = 'completed',
         confirmed_at = now(),
         completed_at = COALESCE(completed_at, now()),
         updated_at = now()
   WHERE id = _order_id;
  -- attempt escrow release (ignore errors if not held)
  IF _o.escrow_status = 'held' THEN
    UPDATE public.orders SET escrow_status = 'released' WHERE id = _order_id;
    INSERT INTO public.escrow_ledger(order_id, user_id, action, amount, note)
      VALUES (_order_id, _uid, 'release', COALESCE(_o.total_amount,0), 'user confirmed completion');
  END IF;
  IF _o.provider_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, type, title, content, related_id)
      VALUES (_o.provider_id, 'order', '订单已结算',
        '用户已确认完成，款项 ¥'||COALESCE(_o.total_amount,0)::text||' 已入账', _order_id::text);
  END IF;
  RETURN jsonb_build_object('success',true);
END $$;

GRANT EXECUTE ON FUNCTION public.user_confirm_complete(uuid) TO authenticated;

-- Step 3: auto-transition paid service orders to pending_accept (extend existing escrow trigger)
CREATE OR REPLACE FUNCTION public.trg_orders_auto_pending_accept()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.payment_status = 'paid'
     AND COALESCE(OLD.payment_status,'') <> 'paid'
     AND COALESCE(NEW.order_type,'') = 'service'
     AND NEW.provider_id IS NULL
     AND NEW.order_status IN ('created','paid','confirmed') THEN
    NEW.order_status := 'pending_accept';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orders_auto_pending_accept ON public.orders;
CREATE TRIGGER trg_orders_auto_pending_accept
  BEFORE UPDATE OF payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_auto_pending_accept();

-- Auto-confirm awaiting_confirm orders after 48h
CREATE OR REPLACE FUNCTION public.auto_confirm_stale_orders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n int := 0; _r record;
BEGIN
  FOR _r IN SELECT id FROM public.orders
    WHERE order_status = 'awaiting_confirm'
      AND completed_at < now() - interval '48 hours'
  LOOP
    UPDATE public.orders
       SET order_status='completed', confirmed_at=now(), updated_at=now()
     WHERE id = _r.id;
    UPDATE public.orders SET escrow_status='released' WHERE id=_r.id AND escrow_status='held';
    INSERT INTO public.escrow_ledger(order_id,user_id,action,amount,note)
      SELECT id, user_id, 'release', total_amount, 'auto confirmed after 48h'
        FROM public.orders WHERE id=_r.id;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;
