
-- 删除旧的宽松演示策略
DROP POLICY IF EXISTS "Authenticated can insert tracking demo" ON public.trip_tracking;
DROP POLICY IF EXISTS "Authenticated can update tracking demo" ON public.trip_tracking;

-- 订单所属用户可写（用于本应用前端模拟司机进度）
CREATE POLICY "Order owner can insert tracking"
  ON public.trip_tracking FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = trip_tracking.order_id AND o.user_id = auth.uid())
  );

CREATE POLICY "Order owner can update tracking"
  ON public.trip_tracking FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = trip_tracking.order_id AND o.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = trip_tracking.order_id AND o.user_id = auth.uid())
  );

-- 司机本人可写自己负责的订单的追踪
CREATE POLICY "Driver can insert own tracking"
  ON public.trip_tracking FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = trip_tracking.order_id AND o.driver_id = auth.uid())
  );

CREATE POLICY "Driver can update own tracking"
  ON public.trip_tracking FOR UPDATE TO authenticated
  USING (
    driver_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = trip_tracking.order_id AND o.driver_id = auth.uid())
  )
  WITH CHECK (
    driver_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = trip_tracking.order_id AND o.driver_id = auth.uid())
  );

-- 触发器：写入时校验 driver_id 与 order.driver_id 一致（允许订单未派单时为 NULL）
CREATE OR REPLACE FUNCTION public.validate_trip_tracking_driver()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order_driver UUID;
  _order_user UUID;
BEGIN
  SELECT driver_id, user_id INTO _order_driver, _order_user
  FROM public.orders WHERE id = NEW.order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', NEW.order_id;
  END IF;

  -- 若订单已派单，则 tracking.driver_id 必须与订单 driver_id 一致
  IF _order_driver IS NOT NULL AND NEW.driver_id IS NOT NULL AND NEW.driver_id <> _order_driver THEN
    RAISE EXCEPTION 'tracking.driver_id (%) must match order.driver_id (%)', NEW.driver_id, _order_driver;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_trip_tracking_driver ON public.trip_tracking;
CREATE TRIGGER trg_validate_trip_tracking_driver
  BEFORE INSERT OR UPDATE ON public.trip_tracking
  FOR EACH ROW EXECUTE FUNCTION public.validate_trip_tracking_driver();
