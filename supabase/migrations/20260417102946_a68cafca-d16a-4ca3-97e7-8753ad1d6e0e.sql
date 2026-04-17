
-- ========== 1. 扩展 posts 表 ==========
ALTER TABLE public.posts 
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'life',
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_posts_category ON public.posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_featured ON public.posts(is_featured) WHERE is_featured = true;

-- ========== 2. 扩展 profiles 表 ==========
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified_real_name BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS love_points INTEGER NOT NULL DEFAULT 0;

-- ========== 3. 用户勋章 ==========
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_code TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  badge_icon TEXT NOT NULL DEFAULT '🏅',
  badge_level TEXT NOT NULL DEFAULT 'bronze',
  awarded_by TEXT NOT NULL DEFAULT 'system',
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_code)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges viewable by everyone" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "Users can self-claim auto badges" ON public.user_badges FOR INSERT 
  TO authenticated WITH CHECK (auth.uid() = user_id AND awarded_by = 'system');

-- ========== 4. 救助日记 ==========
CREATE TABLE IF NOT EXISTS public.rescue_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pet_name TEXT NOT NULL,
  pet_type TEXT NOT NULL DEFAULT 'cat',
  status TEXT NOT NULL DEFAULT 'rescuing',
  before_image TEXT,
  after_image TEXT,
  story TEXT NOT NULL,
  medical_progress TEXT,
  location TEXT,
  cloud_feed_count INTEGER NOT NULL DEFAULT 0,
  cloud_feed_points INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rescue_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rescue stories viewable by everyone" ON public.rescue_stories FOR SELECT USING (is_active = true);
CREATE POLICY "Users can create rescue stories" ON public.rescue_stories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rescue stories" ON public.rescue_stories FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own rescue stories" ON public.rescue_stories FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_rescue_stories_updated_at BEFORE UPDATE ON public.rescue_stories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 5. 云养打卡 ==========
CREATE TABLE IF NOT EXISTS public.cloud_feeding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rescue_story_id UUID NOT NULL REFERENCES public.rescue_stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  points INTEGER NOT NULL DEFAULT 1,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cloud_feeding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cloud feeding viewable by everyone" ON public.cloud_feeding FOR SELECT USING (true);
CREATE POLICY "Users can feed" ON public.cloud_feeding FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ========== 6. TNR 协作 ==========
CREATE TABLE IF NOT EXISTS public.tnr_collaborations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  cats_count INTEGER NOT NULL DEFAULT 1,
  volunteers_needed INTEGER NOT NULL DEFAULT 2,
  volunteers_joined INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'recruiting',
  scheduled_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tnr_collaborations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TNR viewable by everyone" ON public.tnr_collaborations FOR SELECT USING (true);
CREATE POLICY "Users can create TNR" ON public.tnr_collaborations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own TNR" ON public.tnr_collaborations FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_tnr_updated_at BEFORE UPDATE ON public.tnr_collaborations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 7. 走失宠物 ==========
CREATE TABLE IF NOT EXISTS public.lost_pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pet_name TEXT NOT NULL,
  pet_type TEXT NOT NULL DEFAULT 'dog',
  breed TEXT,
  features TEXT NOT NULL,
  image_url TEXT,
  last_seen_location TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  lost_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  virtual_phone TEXT,
  reward_points INTEGER NOT NULL DEFAULT 0,
  donate_to_shelter BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'searching',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lost_pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lost pets viewable by everyone" ON public.lost_pets FOR SELECT USING (true);
CREATE POLICY "Users can report lost pets" ON public.lost_pets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lost pets" ON public.lost_pets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lost pets" ON public.lost_pets FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_lost_pets_updated_at BEFORE UPDATE ON public.lost_pets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_lost_pets_status ON public.lost_pets(status);
CREATE INDEX IF NOT EXISTS idx_lost_pets_location ON public.lost_pets(latitude, longitude);

-- ========== 8. 走失线索 ==========
CREATE TABLE IF NOT EXISTS public.lost_pet_clues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lost_pet_id UUID NOT NULL REFERENCES public.lost_pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  image_url TEXT,
  description TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  spotted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lost_pet_clues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clues viewable by everyone" ON public.lost_pet_clues FOR SELECT USING (true);
CREATE POLICY "Users can submit clues" ON public.lost_pet_clues FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ========== 9. 内容违规记录 ==========
CREATE TABLE IF NOT EXISTS public.content_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content_type TEXT NOT NULL,
  content_snippet TEXT,
  violation_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'auto_blocked',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.content_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own violations" ON public.content_violations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can log own violations" ON public.content_violations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ========== 10. 走失宠物图片存储桶 ==========
INSERT INTO storage.buckets (id, name, public) VALUES ('lost-pet-media', 'lost-pet-media', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('rescue-media', 'rescue-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Lost pet media public read" ON storage.objects FOR SELECT USING (bucket_id = 'lost-pet-media');
CREATE POLICY "Auth users upload lost pet media" ON storage.objects FOR INSERT TO authenticated 
  WITH CHECK (bucket_id = 'lost-pet-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Rescue media public read" ON storage.objects FOR SELECT USING (bucket_id = 'rescue-media');
CREATE POLICY "Auth users upload rescue media" ON storage.objects FOR INSERT TO authenticated 
  WITH CHECK (bucket_id = 'rescue-media' AND auth.uid()::text = (storage.foldername(name))[1]);
