
-- Create pet_hotels table
CREATE TABLE public.pet_hotels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  rating NUMERIC NOT NULL DEFAULT 0,
  reviews_count INTEGER NOT NULL DEFAULT 0,
  price_min NUMERIC NOT NULL DEFAULT 0,
  price_max NUMERIC NOT NULL DEFAULT 0,
  tags TEXT[] NOT NULL DEFAULT '{}',
  amenities TEXT[] NOT NULL DEFAULT '{}',
  phone TEXT,
  image_url TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pet_hotels ENABLE ROW LEVEL SECURITY;

-- Everyone can view active hotels
CREATE POLICY "Active hotels viewable by everyone"
  ON public.pet_hotels
  FOR SELECT
  USING (is_active = true);
