DROP TRIGGER IF EXISTS trg_orders_auto_hold_escrow ON public.orders;
CREATE TRIGGER trg_orders_auto_hold_escrow
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_orders_auto_hold_escrow();

DROP TRIGGER IF EXISTS trg_visit_photo_notify ON public.hotel_visit_photos;
CREATE TRIGGER trg_visit_photo_notify
AFTER INSERT ON public.hotel_visit_photos
FOR EACH ROW EXECUTE FUNCTION public.trg_visit_photo_notify();