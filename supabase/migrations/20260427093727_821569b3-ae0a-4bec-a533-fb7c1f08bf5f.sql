
-- 1. pets 宠物档案表
CREATE TABLE public.pets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  pet_type TEXT NOT NULL DEFAULT 'dog',
  breed TEXT,
  weight_kg NUMERIC,
  birthday DATE,
  avatar_url TEXT,
  vaccinations JSONB NOT NULL DEFAULT '[]'::jsonb,
  allergies TEXT[] NOT NULL DEFAULT '{}',
  behavior_notes TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  auto_share BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pets" ON public.pets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own pets" ON public.pets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pets" ON public.pets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own pets" ON public.pets FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_pets_updated_at BEFORE UPDATE ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. trip_ratings 行程评价表
CREATE TABLE public.trip_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  user_id UUID NOT NULL,
  driver_id UUID,
  overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  safety_rating INTEGER CHECK (safety_rating BETWEEN 1 AND 5),
  pet_care_rating INTEGER CHECK (pet_care_rating BETWEEN 1 AND 5),
  punctuality_rating INTEGER CHECK (punctuality_rating BETWEEN 1 AND 5),
  communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
  quick_tags TEXT[] NOT NULL DEFAULT '{}',
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id, user_id)
);

ALTER TABLE public.trip_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip ratings viewable by everyone" ON public.trip_ratings FOR SELECT USING (true);
CREATE POLICY "Users create own trip ratings" ON public.trip_ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 3. trip_tracking 实时跟踪表
CREATE TABLE public.trip_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  driver_id UUID,
  stage TEXT NOT NULL DEFAULT 'departed' CHECK (stage IN ('departed','picking_up','picked_up','delivered')),
  driver_lat DOUBLE PRECISION,
  driver_lng DOUBLE PRECISION,
  distance_km NUMERIC,
  eta_minutes INTEGER,
  cabin_temperature NUMERIC,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order owner views tracking" ON public.trip_tracking FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = trip_tracking.order_id AND o.user_id = auth.uid()));
CREATE POLICY "Authenticated can insert tracking demo" ON public.trip_tracking FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update tracking demo" ON public.trip_tracking FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_trip_tracking_updated_at BEFORE UPDATE ON public.trip_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. orders 新增字段
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pet_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pet_snapshot JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_id UUID;

-- 5. 索引
CREATE INDEX idx_pets_user ON public.pets(user_id);
CREATE INDEX idx_trip_ratings_driver ON public.trip_ratings(driver_id);
CREATE INDEX idx_trip_ratings_order ON public.trip_ratings(order_id);
CREATE INDEX idx_trip_tracking_order ON public.trip_tracking(order_id);

-- 6. 启用 Realtime
ALTER TABLE public.trip_tracking REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_tracking;
