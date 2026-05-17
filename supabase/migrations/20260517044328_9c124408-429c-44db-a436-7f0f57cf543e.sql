CREATE OR REPLACE FUNCTION public.trg_service_checkins_require_photo_geo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.photo_url IS NULL OR length(trim(NEW.photo_url)) = 0 THEN
    RAISE EXCEPTION 'checkin_photo_required';
  END IF;
  IF NEW.lat IS NULL OR NEW.lng IS NULL THEN
    RAISE EXCEPTION 'checkin_geo_required';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_service_checkins_require_photo_geo ON public.service_checkins;
CREATE TRIGGER trg_service_checkins_require_photo_geo
BEFORE INSERT OR UPDATE ON public.service_checkins
FOR EACH ROW EXECUTE FUNCTION public.trg_service_checkins_require_photo_geo();