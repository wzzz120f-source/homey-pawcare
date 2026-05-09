ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS driver_distance_km numeric,
  ADD COLUMN IF NOT EXISTS driver_fare numeric;