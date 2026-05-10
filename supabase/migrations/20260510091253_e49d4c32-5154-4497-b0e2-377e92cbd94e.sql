
-- ============ 1. Expand pets RLS for active driver orders ============
DROP POLICY IF EXISTS "Drivers view pets of active orders" ON public.pets;
CREATE POLICY "Drivers view pets of active orders" ON public.pets
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = pets.user_id
      AND o.driver_id = auth.uid()
      AND o.order_status = ANY (ARRAY['pending','accepted','confirmed','driver_assigned','pickup_pending','in_progress'])
  )
);

-- ============ 2. Commission settings ============
CREATE TABLE IF NOT EXISTS public.commission_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL UNIQUE,
  mode text NOT NULL DEFAULT 'percent' CHECK (mode IN ('percent','fixed')),
  value numeric(12,2) NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commission_settings_read_all" ON public.commission_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "commission_settings_admin_write" ON public.commission_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.commission_settings(role, mode, value) VALUES
  ('driver','percent',15),
  ('sitter','percent',20),
  ('groomer','percent',20),
  ('merchant','percent',10)
ON CONFLICT (role) DO NOTHING;

-- ============ 3. Provider balances ============
CREATE TABLE IF NOT EXISTS public.provider_balances (
  user_id uuid PRIMARY KEY,
  role app_role NOT NULL,
  available numeric(12,2) NOT NULL DEFAULT 0,
  frozen numeric(12,2) NOT NULL DEFAULT 0,
  withdrawn_total numeric(12,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.provider_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "provider_balances_self_or_admin" ON public.provider_balances
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- ============ 4. Earning transactions ============
CREATE TABLE IF NOT EXISTS public.earning_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  order_id uuid,
  gross numeric(12,2) NOT NULL DEFAULT 0,
  commission numeric(12,2) NOT NULL DEFAULT 0,
  net numeric(12,2) NOT NULL DEFAULT 0,
  settled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_earning_user ON public.earning_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_earning_order ON public.earning_transactions(order_id);
ALTER TABLE public.earning_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "earning_self_or_admin" ON public.earning_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- ============ 5. Withdrawal requests ============
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  fee numeric(12,2) NOT NULL DEFAULT 0,
  actual_amount numeric(12,2) NOT NULL DEFAULT 0,
  bank_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','paid','rejected','flagged')),
  risk_flags text[] NOT NULL DEFAULT '{}',
  reject_reason text,
  voucher_no text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_withdrawal_user ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON public.withdrawal_requests(status);
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "withdrawal_self_or_admin_select" ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "withdrawal_self_insert_pending" ON public.withdrawal_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "withdrawal_admin_update" ON public.withdrawal_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ 6. Approval RPCs for driver/sitter/groomer applications ============
CREATE OR REPLACE FUNCTION public.approve_driver_application(_application_id uuid, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := auth.uid(); _app RECORD; _role app_role;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin,'admin') THEN
    RETURN jsonb_build_object('success',false,'error','forbidden');
  END IF;
  SELECT * INTO _app FROM public.driver_applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF _app.status <> 'pending' THEN RETURN jsonb_build_object('success',false,'error','already_processed'); END IF;

  _role := COALESCE(NULLIF(_app.role_requested,'')::app_role, 'sitter');
  UPDATE public.driver_applications
    SET status='approved', reviewed_by=_admin, reviewed_at=now(), review_note=COALESCE(_note,review_note)
    WHERE id = _application_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (_app.user_id, _role) ON CONFLICT DO NOTHING;
  INSERT INTO public.provider_balances(user_id, role) VALUES (_app.user_id, _role) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.notifications(user_id,title,content,type,related_id)
    VALUES (_app.user_id,'入驻申请已通过','您的'|| _role ||'申请已通过审核，可登录角色面板。','order',_application_id::text);
  RETURN jsonb_build_object('success',true,'role',_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_driver_application(_application_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := auth.uid(); _app RECORD;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin,'admin') THEN
    RETURN jsonb_build_object('success',false,'error','forbidden');
  END IF;
  SELECT * INTO _app FROM public.driver_applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF _app.status <> 'pending' THEN RETURN jsonb_build_object('success',false,'error','already_processed'); END IF;
  UPDATE public.driver_applications
    SET status='rejected', reviewed_by=_admin, reviewed_at=now(), review_note=_reason
    WHERE id = _application_id;
  INSERT INTO public.notifications(user_id,title,content,type,related_id)
    VALUES (_app.user_id,'入驻申请未通过', COALESCE(_reason,'请完善材料后重新提交'),'order',_application_id::text);
  RETURN jsonb_build_object('success',true);
END;
$$;

-- ============ 7. Commission setting RPC ============
CREATE OR REPLACE FUNCTION public.admin_set_commission(_role app_role, _mode text, _value numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := auth.uid();
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin,'admin') THEN
    RETURN jsonb_build_object('success',false,'error','forbidden');
  END IF;
  IF _mode NOT IN ('percent','fixed') THEN
    RETURN jsonb_build_object('success',false,'error','invalid_mode');
  END IF;
  INSERT INTO public.commission_settings(role,mode,value,updated_by,updated_at)
    VALUES (_role,_mode,_value,_admin,now())
    ON CONFLICT (role) DO UPDATE
      SET mode=EXCLUDED.mode, value=EXCLUDED.value, updated_by=_admin, updated_at=now();
  RETURN jsonb_build_object('success',true);
END;
$$;

-- ============ 8. Provider request withdrawal ============
CREATE OR REPLACE FUNCTION public.provider_request_withdrawal(_amount numeric, _bank_info jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _bal RECORD; _fee numeric; _wid uuid;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','unauthorized'); END IF;
  IF _amount <= 0 THEN RETURN jsonb_build_object('success',false,'error','invalid_amount'); END IF;
  SELECT * INTO _bal FROM public.provider_balances WHERE user_id=_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','no_balance'); END IF;
  IF _bal.available < _amount THEN RETURN jsonb_build_object('success',false,'error','insufficient'); END IF;

  _fee := ROUND(_amount * 0.006, 2);  -- 0.6% bank fee
  UPDATE public.provider_balances
    SET available = available - _amount, frozen = frozen + _amount, updated_at = now()
    WHERE user_id = _uid;
  INSERT INTO public.withdrawal_requests(user_id, role, amount, fee, actual_amount, bank_info)
    VALUES (_uid, _bal.role, _amount, _fee, _amount - _fee, COALESCE(_bank_info,'{}'::jsonb))
    RETURNING id INTO _wid;
  RETURN jsonb_build_object('success',true,'id',_wid,'fee',_fee,'actual',_amount - _fee);
END;
$$;

-- ============ 9. Admin approve / force pay / reject withdrawal ============
CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := auth.uid(); _w RECORD; _flags text[] := '{}'; _recent integer; _self_orders integer;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin,'admin') THEN
    RETURN jsonb_build_object('success',false,'error','forbidden');
  END IF;
  SELECT * INTO _w FROM public.withdrawal_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF _w.status <> 'pending' THEN RETURN jsonb_build_object('success',false,'error','already_processed'); END IF;

  -- Risk: 24h frequency
  SELECT count(*) INTO _recent FROM public.withdrawal_requests
    WHERE user_id = _w.user_id AND requested_at > now() - interval '24 hours';
  IF _recent >= 3 THEN _flags := array_append(_flags,'frequent_24h'); END IF;
  IF _w.amount > 5000 THEN _flags := array_append(_flags,'large_amount'); END IF;
  -- Risk: self-buy/sell
  SELECT count(*) INTO _self_orders FROM public.orders
    WHERE driver_id = _w.user_id AND user_id = _w.user_id;
  IF _self_orders > 0 THEN _flags := array_append(_flags,'self_dealing'); END IF;

  IF array_length(_flags,1) > 0 THEN
    UPDATE public.withdrawal_requests
      SET status='flagged', risk_flags=_flags, reviewed_by=_admin, reviewed_at=now()
      WHERE id=_id;
    RETURN jsonb_build_object('success',true,'flagged',true,'risk_flags',_flags);
  END IF;

  UPDATE public.provider_balances
    SET frozen = frozen - _w.amount, withdrawn_total = withdrawn_total + _w.amount, updated_at = now()
    WHERE user_id = _w.user_id;
  UPDATE public.withdrawal_requests
    SET status='paid', reviewed_by=_admin, reviewed_at=now(), paid_at=now(),
        voucher_no = 'PAY' || to_char(now(),'YYYYMMDD') || substr(replace(_id::text,'-',''),1,6)
    WHERE id=_id;
  INSERT INTO public.notifications(user_id,title,content,type,related_id)
    VALUES (_w.user_id,'提现已到账','金额 '|| _w.actual_amount ||' 元已发放','order',_id::text);
  RETURN jsonb_build_object('success',true,'flagged',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_force_pay_withdrawal(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := auth.uid(); _w RECORD;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin,'admin') THEN
    RETURN jsonb_build_object('success',false,'error','forbidden');
  END IF;
  SELECT * INTO _w FROM public.withdrawal_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF _w.status <> 'flagged' THEN RETURN jsonb_build_object('success',false,'error','not_flagged'); END IF;
  UPDATE public.provider_balances
    SET frozen = frozen - _w.amount, withdrawn_total = withdrawn_total + _w.amount, updated_at = now()
    WHERE user_id = _w.user_id;
  UPDATE public.withdrawal_requests
    SET status='paid', reviewed_by=_admin, reviewed_at=now(), paid_at=now(),
        voucher_no = 'PAY' || to_char(now(),'YYYYMMDD') || substr(replace(_id::text,'-',''),1,6)
    WHERE id=_id;
  INSERT INTO public.notifications(user_id,title,content,type,related_id)
    VALUES (_w.user_id,'提现已到账','金额 '|| _w.actual_amount ||' 元已发放','order',_id::text);
  RETURN jsonb_build_object('success',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := auth.uid(); _w RECORD;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin,'admin') THEN
    RETURN jsonb_build_object('success',false,'error','forbidden');
  END IF;
  SELECT * INTO _w FROM public.withdrawal_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF _w.status NOT IN ('pending','flagged') THEN
    RETURN jsonb_build_object('success',false,'error','already_processed');
  END IF;
  UPDATE public.provider_balances
    SET frozen = frozen - _w.amount, available = available + _w.amount, updated_at = now()
    WHERE user_id = _w.user_id;
  UPDATE public.withdrawal_requests
    SET status='rejected', reject_reason=_reason, reviewed_by=_admin, reviewed_at=now()
    WHERE id=_id;
  INSERT INTO public.notifications(user_id,title,content,type,related_id)
    VALUES (_w.user_id,'提现申请被驳回', COALESCE(_reason,'请联系客服'),'order',_id::text);
  RETURN jsonb_build_object('success',true);
END;
$$;

-- ============ 10. Auto-credit driver on order completion ============
CREATE OR REPLACE FUNCTION public.credit_driver_on_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _setting RECORD; _gross numeric; _commission numeric; _net numeric;
BEGIN
  IF NEW.order_status = 'completed' AND OLD.order_status IS DISTINCT FROM 'completed'
     AND NEW.driver_id IS NOT NULL THEN
    _gross := COALESCE(NEW.driver_fare, NEW.total_amount, 0);
    IF _gross <= 0 THEN RETURN NEW; END IF;
    SELECT * INTO _setting FROM public.commission_settings WHERE role='driver';
    IF NOT FOUND THEN _commission := 0;
    ELSIF _setting.mode='percent' THEN _commission := ROUND(_gross * _setting.value / 100, 2);
    ELSE _commission := LEAST(_setting.value, _gross);
    END IF;
    _net := _gross - _commission;
    INSERT INTO public.earning_transactions(user_id, role, order_id, gross, commission, net)
      VALUES (NEW.driver_id, 'driver', NEW.id, _gross, _commission, _net);
    INSERT INTO public.provider_balances(user_id, role, available)
      VALUES (NEW.driver_id, 'driver', _net)
      ON CONFLICT (user_id) DO UPDATE
        SET available = provider_balances.available + _net, updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_driver_on_completion ON public.orders;
CREATE TRIGGER trg_credit_driver_on_completion
  AFTER UPDATE OF order_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.credit_driver_on_completion();
