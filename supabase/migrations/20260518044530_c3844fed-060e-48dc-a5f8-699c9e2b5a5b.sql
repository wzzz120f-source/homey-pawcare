CREATE OR REPLACE FUNCTION public.orders_after_pay_to_hall()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payment_status = 'paid'
     AND COALESCE(OLD.payment_status,'') IS DISTINCT FROM 'paid'
     AND NEW.provider_id IS NULL
     AND NEW.driver_id IS NULL
     AND NEW.hotel_id IS NULL
     AND public.service_type_role(NEW.service_type) IS NOT NULL
     AND NEW.order_status IN ('created','confirmed','paid') THEN
    NEW.order_status := 'pending_accept';
  END IF;
  RETURN NEW;
END $$;

-- Backfill again with relaxed condition
UPDATE public.orders
SET order_status = 'pending_accept'
WHERE payment_status = 'paid'
  AND provider_id IS NULL AND driver_id IS NULL AND hotel_id IS NULL
  AND public.service_type_role(service_type) IS NOT NULL
  AND order_status IN ('created','confirmed','paid');