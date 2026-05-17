
-- 1. Role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hotel_owner';

-- 2. Hotel owners mapping
CREATE TABLE IF NOT EXISTS public.hotel_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  hotel_id uuid NOT NULL REFERENCES public.pet_hotels(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, hotel_id)
);
ALTER TABLE public.hotel_owners ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_hotel_owner(_user_id uuid, _hotel_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.hotel_owners WHERE user_id = _user_id AND hotel_id = _hotel_id);
$$;

CREATE OR REPLACE FUNCTION public.is_any_hotel_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.hotel_owners WHERE user_id = _user_id);
$$;

CREATE POLICY "hotel_owners_self_read" ON public.hotel_owners FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "hotel_owners_super_write" ON public.hotel_owners FOR ALL
  TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- 3. Orders extensions
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS hotel_id uuid REFERENCES public.pet_hotels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES public.hotel_rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS check_in date,
  ADD COLUMN IF NOT EXISTS check_out date,
  ADD COLUMN IF NOT EXISTS nights integer,
  ADD COLUMN IF NOT EXISTS guest_pet_count integer DEFAULT 1;
CREATE INDEX IF NOT EXISTS orders_hotel_id_idx ON public.orders(hotel_id) WHERE hotel_id IS NOT NULL;

CREATE POLICY "Hotel owners can view hotel orders" ON public.orders FOR SELECT
  TO authenticated USING (hotel_id IS NOT NULL AND public.is_hotel_owner(auth.uid(), hotel_id));
CREATE POLICY "Hotel owners can update hotel orders" ON public.orders FOR UPDATE
  TO authenticated USING (hotel_id IS NOT NULL AND public.is_hotel_owner(auth.uid(), hotel_id))
  WITH CHECK (hotel_id IS NOT NULL AND public.is_hotel_owner(auth.uid(), hotel_id));

-- 4. Check logs
CREATE TABLE IF NOT EXISTS public.hotel_check_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.pet_hotels(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('checkin','daily','checkout')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hotel_check_logs_order_idx ON public.hotel_check_logs(order_id);
ALTER TABLE public.hotel_check_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Check logs visible to user and hotel" ON public.hotel_check_logs FOR SELECT
  TO authenticated USING (
    public.is_hotel_owner(auth.uid(), hotel_id)
    OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "Hotel owners insert check logs" ON public.hotel_check_logs FOR INSERT
  TO authenticated WITH CHECK (public.is_hotel_owner(auth.uid(), hotel_id));

-- 5. Visit photos
CREATE TABLE IF NOT EXISTS public.hotel_visit_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.pet_hotels(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL,
  photo_url text NOT NULL,
  caption text,
  visibility text NOT NULL DEFAULT 'order_only' CHECK (visibility IN ('order_only','hotel_internal')),
  taken_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hotel_visit_photos_order_idx ON public.hotel_visit_photos(order_id, taken_at DESC);
ALTER TABLE public.hotel_visit_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visit photos: owner of order can see order_only"
  ON public.hotel_visit_photos FOR SELECT TO authenticated USING (
    (visibility = 'order_only' AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()))
    OR public.is_hotel_owner(auth.uid(), hotel_id)
    OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "Visit photos: hotel owner inserts"
  ON public.hotel_visit_photos FOR INSERT TO authenticated
  WITH CHECK (public.is_hotel_owner(auth.uid(), hotel_id) AND uploader_id = auth.uid());
CREATE POLICY "Visit photos: uploader or super deletes/updates within 24h"
  ON public.hotel_visit_photos FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (uploader_id = auth.uid() AND created_at > now() - interval '24 hours')
  );
CREATE POLICY "Visit photos: uploader updates within 24h"
  ON public.hotel_visit_photos FOR UPDATE TO authenticated
  USING (uploader_id = auth.uid() AND created_at > now() - interval '24 hours' AND public.is_hotel_owner(auth.uid(), hotel_id))
  WITH CHECK (uploader_id = auth.uid());

-- 6. Visit photo notify trigger
CREATE OR REPLACE FUNCTION public.trg_visit_photo_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user uuid; _hotel_name text;
BEGIN
  IF NEW.visibility <> 'order_only' THEN RETURN NEW; END IF;
  SELECT o.user_id INTO _user FROM public.orders o WHERE o.id = NEW.order_id;
  SELECT name INTO _hotel_name FROM public.pet_hotels WHERE id = NEW.hotel_id;
  IF _user IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, content, type, related_id)
      VALUES (_user, '收到一张探视照片', COALESCE(_hotel_name,'酒店') || ' 刚刚分享了爱宠近况',
              'hotel_visit', NEW.order_id::text);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS visit_photo_notify ON public.hotel_visit_photos;
CREATE TRIGGER visit_photo_notify AFTER INSERT ON public.hotel_visit_photos
  FOR EACH ROW EXECUTE FUNCTION public.trg_visit_photo_notify();

-- 7. Hotel checkin / checkout
CREATE OR REPLACE FUNCTION public.hotel_checkin(_order_id uuid, _notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _o public.orders%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','unauthorized'); END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF _o.hotel_id IS NULL OR NOT public.is_hotel_owner(_uid, _o.hotel_id) THEN
    RETURN jsonb_build_object('success',false,'error','forbidden');
  END IF;
  IF _o.payment_status <> 'paid' THEN RETURN jsonb_build_object('success',false,'error','not_paid'); END IF;
  UPDATE public.orders
    SET order_status = 'in_stay', provider_id = COALESCE(provider_id, _uid),
        accepted_at = COALESCE(accepted_at, now()),
        started_at = COALESCE(started_at, now()),
        updated_at = now()
    WHERE id = _order_id;
  INSERT INTO public.hotel_check_logs(order_id, hotel_id, action, notes, created_by)
    VALUES (_order_id, _o.hotel_id, 'checkin', _notes, _uid);
  INSERT INTO public.notifications(user_id, title, content, type, related_id)
    VALUES (_o.user_id, '爱宠已入住酒店', '酒店已为您完成入住登记', 'order', _order_id::text);
  RETURN jsonb_build_object('success', true);
END $$;

CREATE OR REPLACE FUNCTION public.hotel_checkout(_order_id uuid, _notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _o public.orders%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','unauthorized'); END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF _o.hotel_id IS NULL OR NOT public.is_hotel_owner(_uid, _o.hotel_id) THEN
    RETURN jsonb_build_object('success',false,'error','forbidden');
  END IF;
  UPDATE public.orders
    SET order_status = 'awaiting_confirm', completed_at = COALESCE(completed_at, now()), updated_at = now()
    WHERE id = _order_id;
  INSERT INTO public.hotel_check_logs(order_id, hotel_id, action, notes, created_by)
    VALUES (_order_id, _o.hotel_id, 'checkout', _notes, _uid);
  INSERT INTO public.notifications(user_id, title, content, type, related_id)
    VALUES (_o.user_id, '请确认退房并结算', '爱宠已退房，请在订单中确认完成；48小时后系统自动结算', 'order', _order_id::text);
  RETURN jsonb_build_object('success', true);
END $$;

-- 8. Private storage bucket for visit photos
INSERT INTO storage.buckets (id, name, public) VALUES ('hotel-visits','hotel-visits', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "hotel-visits read by user or hotel owner"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'hotel-visits' AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.hotel_visit_photos vp
        JOIN public.orders o ON o.id = vp.order_id
        WHERE vp.photo_url LIKE '%' || name
          AND (o.user_id = auth.uid() OR public.is_hotel_owner(auth.uid(), vp.hotel_id))
      )
    )
  );
CREATE POLICY "hotel-visits insert by hotel owner"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'hotel-visits'
    AND public.is_hotel_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "hotel-visits delete by uploader"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'hotel-visits' AND owner = auth.uid());
