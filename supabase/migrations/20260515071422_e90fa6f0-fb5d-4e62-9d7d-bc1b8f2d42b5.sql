
-- 1. orders.escrow_status
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS escrow_status text NOT NULL DEFAULT 'none';
COMMENT ON COLUMN public.orders.escrow_status IS 'none | held | released | refunded';

-- 2. escrow_ledger
CREATE TABLE IF NOT EXISTS public.escrow_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_escrow_ledger_order ON public.escrow_ledger(order_id);
ALTER TABLE public.escrow_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS escrow_ledger_select_related ON public.escrow_ledger;
CREATE POLICY escrow_ledger_select_related ON public.escrow_ledger
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = escrow_ledger.order_id
        AND (o.user_id = auth.uid() OR o.driver_id = auth.uid())
    )
  );

-- 3. get_provider_stats
CREATE OR REPLACE FUNCTION public.get_provider_stats(provider_uid uuid)
RETURNS TABLE(orders_done bigint, avg_rating numeric, review_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.orders o
       WHERE o.driver_id = provider_uid AND o.order_status = 'completed') AS orders_done,
    COALESCE((
      SELECT avg(rating)::numeric(3,2) FROM (
        SELECT rating FROM public.order_reviews r
          JOIN public.orders o ON o.id = r.order_id
         WHERE o.driver_id = provider_uid
        UNION ALL
        SELECT overall AS rating FROM public.groomer_ratings
         WHERE groomer_id = provider_uid
      ) ratings
    ), 5.0) AS avg_rating,
    (
      (SELECT count(*) FROM public.order_reviews r
         JOIN public.orders o ON o.id = r.order_id
        WHERE o.driver_id = provider_uid)
      +
      (SELECT count(*) FROM public.groomer_ratings WHERE groomer_id = provider_uid)
    ) AS review_count
$$;

-- 4. release_escrow (买家确认完成后释放)
CREATE OR REPLACE FUNCTION public.release_escrow(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF o.user_id <> auth.uid() AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  IF o.escrow_status <> 'held' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_held', 'status', o.escrow_status);
  END IF;
  IF o.order_status NOT IN ('completed','done') THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_completed');
  END IF;

  UPDATE public.orders SET escrow_status = 'released', updated_at = now() WHERE id = _order_id;
  INSERT INTO public.escrow_ledger(order_id, user_id, action, amount, note)
    VALUES (_order_id, auth.uid(), 'release', COALESCE(o.total_amount, 0), 'user confirmed completion');
  RETURN jsonb_build_object('success', true);
END;
$$;
