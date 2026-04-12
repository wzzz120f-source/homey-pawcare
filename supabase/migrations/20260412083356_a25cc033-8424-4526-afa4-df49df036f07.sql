
-- Create hotel_reviews table
CREATE TABLE public.hotel_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.pet_hotels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  content TEXT,
  images TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hotel_reviews ENABLE ROW LEVEL SECURITY;

-- Everyone can view reviews
CREATE POLICY "Hotel reviews viewable by everyone"
  ON public.hotel_reviews FOR SELECT USING (true);

-- Authenticated users can create reviews
CREATE POLICY "Users can create hotel reviews"
  ON public.hotel_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete own reviews
CREATE POLICY "Users can delete own hotel reviews"
  ON public.hotel_reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Storage bucket for review images
INSERT INTO storage.buckets (id, name, public) VALUES ('hotel-review-images', 'hotel-review-images', true);

CREATE POLICY "Hotel review images publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hotel-review-images');

CREATE POLICY "Users can upload hotel review images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'hotel-review-images' AND auth.uid()::text = (storage.foldername(name))[1]);
