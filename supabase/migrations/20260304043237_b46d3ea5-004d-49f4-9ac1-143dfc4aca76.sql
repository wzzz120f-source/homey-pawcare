
-- Create favorites table
CREATE TABLE public.favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
ON public.favorites FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can add favorites"
ON public.favorites FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove favorites"
ON public.favorites FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Create browsing history table
CREATE TABLE public.browsing_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.browsing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own history"
ON public.browsing_history FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can add history"
ON public.browsing_history FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can clear history"
ON public.browsing_history FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_favorites_user ON public.favorites(user_id);
CREATE INDEX idx_browsing_history_user ON public.browsing_history(user_id, viewed_at DESC);
