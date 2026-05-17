
CREATE OR REPLACE FUNCTION public.process_refund(_refund_id uuid, _action text, _note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF _o.is_physical AND NOT _is_admin THEN RETURN jsonb_build_object('success',false,'error','admin_only'); END IF;
  IF NOT _o.is_physical AND NOT (_is_admin OR _is_provider) THEN RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;

  IF _action = 'reject' THEN
    UPDATE public.payment_refunds SET status='rejected', operator_id=_uid, operator_note=_note, updated_at=now() WHERE id=_refund_id;
    UPDATE public.orders SET refund_status='rejected', updated_at=now() WHERE id=_o.id;
    INSERT INTO public.notifications(user_id,title,content,type,related_id)
      VALUES (_r.user_id,'退款申请被拒绝',COALESCE(_note,'请联系客服了解详情'),'order',_o.id::text);
    RETURN jsonb_build_object('success',true,'status','rejected');
  END IF;

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
    -- 担保资金回滚 + 闪购库存回补
    PERFORM public.rollback_escrow(_o.id, COALESCE(_r.reason,'refund approved'));
    IF _o.flash_sale_id IS NOT NULL THEN
      PERFORM public.restore_flash_stock(_o.id);
    END IF;
  ELSE
    UPDATE public.payment_refunds SET status='approved', operator_id=_uid, operator_note=_note, updated_at=now() WHERE id=_refund_id;
    UPDATE public.orders SET refund_status='approved', updated_at=now() WHERE id=_o.id;
  END IF;

  INSERT INTO public.notifications(user_id,title,content,type,related_id)
    VALUES (_r.user_id,'退款申请已通过','金额 '|| _r.amount ||' 元正在处理','order',_o.id::text);
  RETURN jsonb_build_object('success',true,'status','approved','channel',_p.channel);
END $function$;
