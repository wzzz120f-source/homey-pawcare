
-- 1. 清理重复触发器（保留 BEFORE 版）
DROP TRIGGER IF EXISTS trg_orders_auto_hold_escrow ON public.orders;

-- 2. orders 增加 flash_sale_id
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS flash_sale_id UUID REFERENCES public.flash_sales(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_flash_sale ON public.orders(flash_sale_id) WHERE flash_sale_id IS NOT NULL;

-- 3. restore_flash_stock：回补闪购+商品库存
CREATE OR REPLACE FUNCTION public.restore_flash_stock(_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _o RECORD; _qty INT; _pid UUID;
BEGIN
  SELECT id, flash_sale_id, total_amount INTO _o FROM public.orders WHERE id = _order_id;
  IF _o.flash_sale_id IS NULL THEN RETURN jsonb_build_object('skipped', true); END IF;

  SELECT COALESCE(SUM(quantity),0), MAX(product_id) INTO _qty, _pid
    FROM public.order_items WHERE order_id = _order_id;
  IF _qty <= 0 THEN RETURN jsonb_build_object('skipped', true, 'reason','no_items'); END IF;

  UPDATE public.flash_sales
     SET sold_count = GREATEST(sold_count - _qty, 0)
   WHERE id = _o.flash_sale_id;

  IF _pid IS NOT NULL THEN
    UPDATE public.products
       SET stock = stock + _qty,
           sales_count = GREATEST(COALESCE(sales_count,0) - _qty, 0)
     WHERE id = _pid;
  END IF;

  RETURN jsonb_build_object('success', true, 'restored', _qty);
END $$;

-- 4. rollback_escrow：取消/退款时回滚担保资金
CREATE OR REPLACE FUNCTION public.rollback_escrow(_order_id UUID, _reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _o public.orders%ROWTYPE;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error','not_found'); END IF;

  IF _o.escrow_status = 'held' THEN
    UPDATE public.orders SET escrow_status='refunded', updated_at=now() WHERE id=_order_id;
    INSERT INTO public.escrow_ledger(order_id, user_id, action, amount, note)
      VALUES (_order_id, _o.user_id, 'refund', COALESCE(_o.total_amount,0), COALESCE(_reason,'rollback on cancel/refund'));
  ELSIF _o.escrow_status = 'none' THEN
    UPDATE public.orders SET escrow_status='failed', updated_at=now() WHERE id=_order_id;
    INSERT INTO public.escrow_ledger(order_id, user_id, action, amount, note)
      VALUES (_order_id, _o.user_id, 'cancel_unheld', 0, COALESCE(_reason,'cancelled before hold'));
  END IF;

  -- 闪购订单同时回补库存
  IF _o.flash_sale_id IS NOT NULL AND _o.order_status IN ('cancelled') THEN
    PERFORM public.restore_flash_stock(_order_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'escrow_status', (SELECT escrow_status FROM public.orders WHERE id=_order_id));
END $$;

-- 5. create_flash_order：原子下单
CREATE OR REPLACE FUNCTION public.create_flash_order(
  _flash_id UUID,
  _qty INT,
  _shipping_address JSONB DEFAULT NULL,
  _payment_method TEXT DEFAULT 'wallet',
  _notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _f RECORD;
  _p RECORD;
  _order_id UUID;
  _total NUMERIC;
  _addr_snap JSONB;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error','unauthorized'); END IF;
  IF _qty IS NULL OR _qty <= 0 THEN RETURN jsonb_build_object('success', false, 'error','invalid_qty'); END IF;

  SELECT * INTO _f FROM public.flash_sales WHERE id=_flash_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error','flash_not_found'); END IF;
  IF NOT _f.is_active THEN RETURN jsonb_build_object('success', false, 'error','flash_inactive'); END IF;
  IF now() < _f.starts_at OR now() > _f.ends_at THEN
    RETURN jsonb_build_object('success', false, 'error','flash_window_closed');
  END IF;
  IF _f.stock - _f.sold_count < _qty THEN
    RETURN jsonb_build_object('success', false, 'error','sold_out', 'remaining', _f.stock - _f.sold_count);
  END IF;

  SELECT * INTO _p FROM public.products WHERE id=_f.product_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error','product_not_found'); END IF;
  IF COALESCE(_p.stock,0) < _qty THEN
    RETURN jsonb_build_object('success', false, 'error','product_out_of_stock');
  END IF;

  _total := _f.flash_price * _qty;
  _addr_snap := COALESCE(_shipping_address, '{}'::jsonb);

  UPDATE public.flash_sales SET sold_count = sold_count + _qty WHERE id=_flash_id;
  UPDATE public.products
     SET stock = stock - _qty,
         sales_count = COALESCE(sales_count,0) + _qty
   WHERE id=_p.id;

  INSERT INTO public.orders(
    user_id, order_type, total_amount, payment_method, payment_status,
    order_status, is_physical, flash_sale_id, shipping_address_snapshot, notes
  ) VALUES (
    _uid, 'product', _total, _payment_method, 'pending',
    'created', true, _flash_id, _addr_snap, _notes
  ) RETURNING id INTO _order_id;

  INSERT INTO public.order_items(
    order_id, product_id, merchant_id, product_name, unit_price, quantity, cover_image
  ) VALUES (
    _order_id, _p.id, _p.merchant_id, _p.name, _f.flash_price, _qty, _p.cover_image
  );

  RETURN jsonb_build_object('success', true, 'order_id', _order_id, 'total_amount', _total);
END $$;

-- 6. 历史回填：把已付却仍 escrow=none 的服务订单标为 held
DO $$
DECLARE _r RECORD;
BEGIN
  FOR _r IN
    SELECT id, user_id, total_amount FROM public.orders
     WHERE payment_status='paid'
       AND escrow_status='none'
       AND COALESCE(order_type,'') <> 'product'
       AND order_status NOT IN ('cancelled','completed','refunded')
  LOOP
    UPDATE public.orders SET escrow_status='held' WHERE id=_r.id;
    INSERT INTO public.escrow_ledger(order_id, user_id, action, amount, note)
      VALUES (_r.id, _r.user_id, 'hold', COALESCE(_r.total_amount,0), 'backfill on migration');
  END LOOP;
END $$;
