
CREATE OR REPLACE FUNCTION public.trg_orders_auto_hold_escrow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'paid'
     AND COALESCE(OLD.payment_status,'') <> 'paid'
     AND COALESCE(NEW.escrow_status,'none') = 'none'
     AND COALESCE(NEW.order_type,'') <> 'product' THEN
    NEW.escrow_status := 'held';
    INSERT INTO public.escrow_ledger(order_id, user_id, action, amount, note)
      VALUES (NEW.id, NEW.user_id, 'hold', COALESCE(NEW.total_amount, 0), 'auto hold on payment');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_auto_hold_escrow ON public.orders;
CREATE TRIGGER orders_auto_hold_escrow
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_orders_auto_hold_escrow();
