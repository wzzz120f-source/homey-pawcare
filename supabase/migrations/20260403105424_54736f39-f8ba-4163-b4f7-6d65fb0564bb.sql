
-- Banners for homepage carousel
CREATE TABLE public.banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Banners viewable by everyone" ON public.banners FOR SELECT USING (is_active = true);

-- Flash sales
CREATE TABLE public.flash_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  flash_price NUMERIC NOT NULL,
  original_price NUMERIC NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  sold_count INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Flash sales viewable by everyone" ON public.flash_sales FOR SELECT USING (is_active = true);

-- Order reviews with media support
CREATE TABLE public.order_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.order_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews viewable by everyone" ON public.order_reviews FOR SELECT USING (true);
CREATE POLICY "Users can create own reviews" ON public.order_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Review media (images/videos)
CREATE TABLE public.review_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID REFERENCES public.order_reviews(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.review_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Review media viewable by everyone" ON public.review_media FOR SELECT USING (true);
CREATE POLICY "Users can upload review media" ON public.review_media FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.order_reviews WHERE id = review_media.review_id AND user_id = auth.uid())
);

-- Merchant appeals
CREATE TABLE public.merchant_appeals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  description TEXT NOT NULL,
  contact_info TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reply TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.merchant_appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own appeals" ON public.merchant_appeals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create appeals" ON public.merchant_appeals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Storage bucket for review media
INSERT INTO storage.buckets (id, name, public) VALUES ('review-media', 'review-media', true);
CREATE POLICY "Review media publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'review-media');
CREATE POLICY "Authenticated users can upload review media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'review-media');
