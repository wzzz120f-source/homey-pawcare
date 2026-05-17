
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_refund_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_refund_status_check
  CHECK (refund_status = ANY (ARRAY['none','requested','approved','rejected','refunded','partial']));

CREATE OR REPLACE FUNCTION public.restore_flash_stock_partial(_order_id uuid, _ratio numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _o RECORD; _qty INT; _pid UUID; _restore INT;
BEGIN
  SELECT id, flash_sale_id INTO _o FROM public.orders WHERE id = _order_id;
  IF _o.flash_sale_id IS NULL THEN RETURN jsonb_build_object('skipped', true); END IF;
  SELECT COALESCE(SUM(quantity),0), MAX(product_id) INTO _qty, _pid
    FROM public.order_items WHERE order_id = _order_id;
  IF _qty <= 0 OR _ratio <= 0 THEN RETURN jsonb_build_object('skipped', true); END IF;
  _restore := LEAST(GREATEST(1, FLOOR(_qty * LEAST(_ratio,1))::int), _qty);
  UPDATE public.flash_sales SET sold_count = GREATEST(sold_count - _restore, 0)
    WHERE id = _o.flash_sale_id;
  IF _pid IS NOT NULL THEN
    UPDATE public.products
       SET stock = stock + _restore,
           sales_count = GREATEST(COALESCE(sales_count,0) - _restore, 0)
     WHERE id = _pid;
  END IF;
  RETURN jsonb_build_object('success',true,'restored',_restore);
END $$;

CREATE OR REPLACE FUNCTION public.partial_refund(_order_id uuid, _amount numeric, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid(); _o RECORD; _ratio numeric; _eta text; _new_total numeric;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid,'admin') THEN
    RETURN jsonb_build_object('success',false,'error','forbidden');
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('success',false,'error','invalid_amount');
  END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF _o.escrow_status NOT IN ('held','released_partial') THEN
    RETURN jsonb_build_object('success',false,'error','escrow_not_refundable','status',_o.escrow_status);
  END IF;
  _new_total := COALESCE(_o.refund_amount,0) + _amount;
  IF _new_total >= _o.total_amount THEN
    RETURN jsonb_build_object('success',false,'error','use_full_refund','suggested', _o.total_amount - COALESCE(_o.refund_amount,0));
  END IF;
  _ratio := _amount / NULLIF(_o.total_amount,0);

  INSERT INTO public.escrow_ledger(order_id, user_id, action, amount, note)
    VALUES (_order_id, _o.user_id, 'partial_refund', _amount, COALESCE(_reason,'部分退款'));

  UPDATE public.orders
     SET escrow_status = 'released_partial',
         refund_amount = _new_total,
         refund_status = 'partial',
         updated_at = now()
   WHERE id = _order_id;

  PERFORM public.restore_flash_stock_partial(_order_id, _ratio);

  IF _o.payment_method = 'wallet' THEN
    INSERT INTO public.user_wallets(user_id, balance) VALUES (_o.user_id, _amount)
      ON CONFLICT (user_id) DO UPDATE SET balance = public.user_wallets.balance + _amount, updated_at = now();
    INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, related_order_id, description)
      SELECT _o.user_id, 'refund', _amount,
             (SELECT balance FROM public.user_wallets WHERE user_id=_o.user_id),
             _order_id, '部分退款入账';
  END IF;

  _eta := CASE _o.payment_method
    WHEN 'wallet' THEN '已实时退至钱包余额'
    WHEN 'wechat' THEN '微信原路退回，预计 1-3 个工作日到账'
    WHEN 'alipay' THEN '支付宝原路退回，预计 1-3 个工作日到账'
    WHEN 'bank'   THEN '银行卡退款，预计 3-7 个工作日到账'
    ELSE '原渠道退款，预计 1-3 个工作日到账' END;

  INSERT INTO public.notifications(user_id,type,title,content,related_id)
    VALUES (_o.user_id,'refund','收到部分退款 ¥'||_amount::text,
            COALESCE(_reason,'部分退款')||' · '||_eta, _order_id::text);

  RETURN jsonb_build_object('success',true,'refunded',_amount,'total_refunded',_new_total,'eta',_eta);
END $$;

DROP FUNCTION IF EXISTS public.rollback_escrow(uuid, text);

CREATE OR REPLACE FUNCTION public.rollback_escrow(_order_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _o RECORD; _eta text; _refund_amt numeric;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;

  IF _o.escrow_status = 'held' THEN
    _refund_amt := _o.total_amount - COALESCE(_o.refund_amount,0);
    UPDATE public.orders
       SET escrow_status = 'refunded',
           refund_amount = _o.total_amount,
           refund_status = 'refunded',
           updated_at = now()
     WHERE id = _order_id;
    INSERT INTO public.escrow_ledger(order_id, user_id, action, amount, note)
      VALUES (_order_id, _o.user_id, 'refund', _refund_amt, COALESCE(_reason,'订单取消'));
    PERFORM public.restore_flash_stock(_order_id);
  ELSIF _o.escrow_status IN ('released_partial') THEN
    _refund_amt := _o.total_amount - COALESCE(_o.refund_amount,0);
    UPDATE public.orders
       SET escrow_status = 'refunded',
           refund_amount = _o.total_amount,
           refund_status = 'refunded',
           updated_at = now()
     WHERE id = _order_id;
    INSERT INTO public.escrow_ledger(order_id, user_id, action, amount, note)
      VALUES (_order_id, _o.user_id, 'refund', _refund_amt, COALESCE(_reason,'剩余款项退款'));
    PERFORM public.restore_flash_stock(_order_id);
  ELSIF _o.escrow_status IN ('none','failed') THEN
    UPDATE public.orders SET escrow_status='failed', updated_at=now() WHERE id=_order_id;
    INSERT INTO public.escrow_ledger(order_id, user_id, action, amount, note)
      VALUES (_order_id, _o.user_id, 'cancel_unheld', 0, COALESCE(_reason,'未担保订单取消'));
    _refund_amt := 0;
  ELSE
    RETURN jsonb_build_object('success',false,'error','already_settled','status',_o.escrow_status);
  END IF;

  _eta := CASE _o.payment_method
    WHEN 'wallet' THEN '已实时退至钱包余额'
    WHEN 'wechat' THEN '微信原路退回，预计 1-3 个工作日到账'
    WHEN 'alipay' THEN '支付宝原路退回，预计 1-3 个工作日到账'
    WHEN 'bank'   THEN '银行卡退款，预计 3-7 个工作日到账'
    ELSE '原渠道退款，预计 1-3 个工作日到账' END;

  IF _refund_amt > 0 THEN
    INSERT INTO public.notifications(user_id,type,title,content,related_id)
      VALUES (_o.user_id,'refund','订单已取消 · 退款 ¥'||_refund_amt::text,
              COALESCE(_reason,'订单已取消')||' · '||_eta, _order_id::text);
  ELSE
    INSERT INTO public.notifications(user_id,type,title,content,related_id)
      VALUES (_o.user_id,'order','订单已取消',
              COALESCE(_reason,'订单已取消')||' · 该订单未发生扣款', _order_id::text);
  END IF;

  RETURN jsonb_build_object('success',true,'refunded',_refund_amt,'eta',_eta);
END $$;
