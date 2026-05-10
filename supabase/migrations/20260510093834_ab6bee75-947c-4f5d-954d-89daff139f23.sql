
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.admin_audit_logs(action);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_admin_read" ON public.admin_audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- helper
CREATE OR REPLACE FUNCTION public.log_admin_action(_action text, _target_type text, _target_id text, _details jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.admin_audit_logs(admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), _action, _target_type, _target_id, COALESCE(_details, '{}'::jsonb));
$$;

-- patch RPCs to write audit
CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal(_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE _admin uuid := auth.uid(); _w RECORD; _flags text[] := '{}'; _recent integer; _self_orders integer;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin,'admin') THEN
    RETURN jsonb_build_object('success',false,'error','forbidden');
  END IF;
  SELECT * INTO _w FROM public.withdrawal_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF _w.status <> 'pending' THEN RETURN jsonb_build_object('success',false,'error','already_processed'); END IF;
  SELECT count(*) INTO _recent FROM public.withdrawal_requests
    WHERE user_id = _w.user_id AND requested_at > now() - interval '24 hours';
  IF _recent >= 3 THEN _flags := array_append(_flags,'frequent_24h'); END IF;
  IF _w.amount > 5000 THEN _flags := array_append(_flags,'large_amount'); END IF;
  SELECT count(*) INTO _self_orders FROM public.orders
    WHERE driver_id = _w.user_id AND user_id = _w.user_id;
  IF _self_orders > 0 THEN _flags := array_append(_flags,'self_dealing'); END IF;

  IF array_length(_flags,1) > 0 THEN
    UPDATE public.withdrawal_requests SET status='flagged', risk_flags=_flags, reviewed_by=_admin, reviewed_at=now() WHERE id=_id;
    PERFORM public.log_admin_action('withdrawal_flagged','withdrawal',_id::text, jsonb_build_object('amount',_w.amount,'risk_flags',_flags));
    RETURN jsonb_build_object('success',true,'flagged',true,'risk_flags',_flags);
  END IF;
  UPDATE public.provider_balances SET frozen = frozen - _w.amount, withdrawn_total = withdrawn_total + _w.amount, updated_at=now() WHERE user_id = _w.user_id;
  UPDATE public.withdrawal_requests
    SET status='paid', reviewed_by=_admin, reviewed_at=now(), paid_at=now(),
        voucher_no = 'PAY' || to_char(now(),'YYYYMMDD') || substr(replace(_id::text,'-',''),1,6)
    WHERE id=_id;
  INSERT INTO public.notifications(user_id,title,content,type,related_id)
    VALUES (_w.user_id,'提现已到账','金额 '|| _w.actual_amount ||' 元已发放','order',_id::text);
  PERFORM public.log_admin_action('withdrawal_approved','withdrawal',_id::text, jsonb_build_object('amount',_w.amount,'actual',_w.actual_amount));
  RETURN jsonb_build_object('success',true,'flagged',false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_force_pay_withdrawal(_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE _admin uuid := auth.uid(); _w RECORD;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin,'admin') THEN
    RETURN jsonb_build_object('success',false,'error','forbidden');
  END IF;
  SELECT * INTO _w FROM public.withdrawal_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF _w.status <> 'flagged' THEN RETURN jsonb_build_object('success',false,'error','not_flagged'); END IF;
  UPDATE public.provider_balances SET frozen = frozen - _w.amount, withdrawn_total = withdrawn_total + _w.amount, updated_at=now() WHERE user_id = _w.user_id;
  UPDATE public.withdrawal_requests
    SET status='paid', reviewed_by=_admin, reviewed_at=now(), paid_at=now(),
        voucher_no = 'PAY' || to_char(now(),'YYYYMMDD') || substr(replace(_id::text,'-',''),1,6)
    WHERE id=_id;
  INSERT INTO public.notifications(user_id,title,content,type,related_id)
    VALUES (_w.user_id,'提现已到账','金额 '|| _w.actual_amount ||' 元已发放','order',_id::text);
  PERFORM public.log_admin_action('withdrawal_force_paid','withdrawal',_id::text, jsonb_build_object('amount',_w.amount,'risk_flags',_w.risk_flags));
  RETURN jsonb_build_object('success',true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(_id uuid, _reason text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
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
  UPDATE public.provider_balances SET frozen = frozen - _w.amount, available = available + _w.amount, updated_at=now() WHERE user_id = _w.user_id;
  UPDATE public.withdrawal_requests SET status='rejected', reject_reason=_reason, reviewed_by=_admin, reviewed_at=now() WHERE id=_id;
  INSERT INTO public.notifications(user_id,title,content,type,related_id)
    VALUES (_w.user_id,'提现申请被驳回', COALESCE(_reason,'请联系客服'),'order',_id::text);
  PERFORM public.log_admin_action('withdrawal_rejected','withdrawal',_id::text, jsonb_build_object('reason',_reason,'amount',_w.amount));
  RETURN jsonb_build_object('success',true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_commission(_role app_role, _mode text, _value numeric)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
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
  PERFORM public.log_admin_action('commission_updated','commission',_role::text, jsonb_build_object('mode',_mode,'value',_value));
  RETURN jsonb_build_object('success',true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_driver_application(_application_id uuid, _note text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE _admin uuid := auth.uid(); _app RECORD; _role app_role;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin,'admin') THEN
    RETURN jsonb_build_object('success',false,'error','forbidden');
  END IF;
  SELECT * INTO _app FROM public.driver_applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF _app.status <> 'pending' THEN RETURN jsonb_build_object('success',false,'error','already_processed'); END IF;
  _role := COALESCE(NULLIF(_app.role_requested,'')::app_role, 'sitter');
  UPDATE public.driver_applications SET status='approved', reviewed_by=_admin, reviewed_at=now(), review_note=COALESCE(_note,review_note) WHERE id = _application_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (_app.user_id, _role) ON CONFLICT DO NOTHING;
  INSERT INTO public.provider_balances(user_id, role) VALUES (_app.user_id, _role) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.notifications(user_id,title,content,type,related_id)
    VALUES (_app.user_id,'入驻申请已通过','您的'|| _role ||'申请已通过审核，可登录角色面板。','order',_application_id::text);
  PERFORM public.log_admin_action('driver_application_approved','driver_application',_application_id::text, jsonb_build_object('role',_role,'user_id',_app.user_id));
  RETURN jsonb_build_object('success',true,'role',_role);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_driver_application(_application_id uuid, _reason text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE _admin uuid := auth.uid(); _app RECORD;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin,'admin') THEN
    RETURN jsonb_build_object('success',false,'error','forbidden');
  END IF;
  SELECT * INTO _app FROM public.driver_applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF _app.status <> 'pending' THEN RETURN jsonb_build_object('success',false,'error','already_processed'); END IF;
  UPDATE public.driver_applications SET status='rejected', reviewed_by=_admin, reviewed_at=now(), review_note=_reason WHERE id = _application_id;
  INSERT INTO public.notifications(user_id,title,content,type,related_id)
    VALUES (_app.user_id,'入驻申请未通过', COALESCE(_reason,'请完善材料后重新提交'),'order',_application_id::text);
  PERFORM public.log_admin_action('driver_application_rejected','driver_application',_application_id::text, jsonb_build_object('reason',_reason,'user_id',_app.user_id));
  RETURN jsonb_build_object('success',true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_merchant_application(_application_id uuid, _note text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE _admin UUID := auth.uid(); _app RECORD; _merchant_id UUID;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  SELECT * INTO _app FROM public.merchant_applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  IF _app.status <> 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'already_processed'); END IF;
  INSERT INTO public.merchants(name, description, contact_phone, address, license_number, license_image_url, is_verified)
    VALUES (_app.store_name, _app.description, _app.contact_phone, _app.address, _app.license_number, _app.license_image_url, true)
    RETURNING id INTO _merchant_id;
  INSERT INTO public.merchant_owners(user_id, merchant_id) VALUES (_app.user_id, _merchant_id);
  INSERT INTO public.user_roles(user_id, role) VALUES (_app.user_id, 'merchant') ON CONFLICT DO NOTHING;
  UPDATE public.merchant_applications
    SET status = 'approved', reviewed_by = _admin, reviewed_at = now(),
        review_note = COALESCE(_note, review_note), created_merchant_id = _merchant_id
    WHERE id = _application_id;
  INSERT INTO public.notifications(user_id, title, content, type, related_id)
    VALUES (_app.user_id, '商家入驻申请已通过', '恭喜！您的店铺「' || _app.store_name || '」已通过审核，可在个人中心进入商家中心管理产品。', 'merchant', _merchant_id::text);
  PERFORM public.log_admin_action('merchant_application_approved','merchant_application',_application_id::text, jsonb_build_object('merchant_id',_merchant_id,'user_id',_app.user_id));
  RETURN jsonb_build_object('success', true, 'merchant_id', _merchant_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_merchant_application(_application_id uuid, _note text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE _admin UUID := auth.uid(); _app RECORD;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  SELECT * INTO _app FROM public.merchant_applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  IF _app.status <> 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'already_processed'); END IF;
  UPDATE public.merchant_applications
    SET status = 'rejected', reviewed_by = _admin, reviewed_at = now(), review_note = _note
    WHERE id = _application_id;
  INSERT INTO public.notifications(user_id, title, content, type, related_id)
    VALUES (_app.user_id, '商家入驻申请未通过', COALESCE(_note, '请完善材料后重新提交'), 'merchant', _application_id::text);
  PERFORM public.log_admin_action('merchant_application_rejected','merchant_application',_application_id::text, jsonb_build_object('reason',_note,'user_id',_app.user_id));
  RETURN jsonb_build_object('success', true);
END;
$function$;
