-- ===== 1. 积分流水表 =====
CREATE TABLE public.love_point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL, -- 'post_create','post_liked','cloud_feed','clue_submit','lost_pet_report','redeem','donate','exchange'
  points INTEGER NOT NULL, -- 正数=获得，负数=消费
  related_type TEXT, -- 'post','rescue_story','lost_pet','clue','order','donation','item'
  related_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lpt_user ON public.love_point_transactions(user_id, created_at DESC);
ALTER TABLE public.love_point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transactions" ON public.love_point_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ===== 2. 积分专区兑换商品 =====
CREATE TABLE public.point_redeemable_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  points_required INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'goods', -- 'goods','coupon','virtual'
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.point_redeemable_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Items viewable by everyone" ON public.point_redeemable_items
  FOR SELECT USING (is_active = true);

-- ===== 3. 公益捐赠记录 =====
CREATE TABLE public.point_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  points INTEGER NOT NULL CHECK (points > 0),
  target_type TEXT NOT NULL, -- 'platform_pool','rescue_story'
  target_id UUID, -- rescue_stories.id 当 target_type='rescue_story'
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_donation_target ON public.point_donations(target_type, target_id);
ALTER TABLE public.point_donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Donations public for transparency" ON public.point_donations FOR SELECT USING (true);

-- ===== 4. 每日封顶追踪 =====
CREATE TABLE public.daily_point_caps (
  user_id UUID NOT NULL,
  cap_date DATE NOT NULL DEFAULT CURRENT_DATE,
  points_earned INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, cap_date)
);
ALTER TABLE public.daily_point_caps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own caps" ON public.daily_point_caps
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ===== 5. 核心函数 =====
CREATE OR REPLACE FUNCTION public.award_love_points(
  _action TEXT,
  _points INTEGER,
  _related_type TEXT DEFAULT NULL,
  _related_id TEXT DEFAULT NULL,
  _description TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := CURRENT_DATE;
  _earned INTEGER := 0;
  _cap INTEGER := 100;
  _grant INTEGER;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  IF _points <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_points'); END IF;

  INSERT INTO daily_point_caps(user_id, cap_date, points_earned)
  VALUES (_uid, _today, 0)
  ON CONFLICT (user_id, cap_date) DO NOTHING;

  SELECT points_earned INTO _earned FROM daily_point_caps WHERE user_id = _uid AND cap_date = _today;
  _grant := LEAST(_points, GREATEST(_cap - _earned, 0));

  IF _grant <= 0 THEN
    RETURN jsonb_build_object('success', true, 'granted', 0, 'capped', true);
  END IF;

  UPDATE daily_point_caps SET points_earned = points_earned + _grant
    WHERE user_id = _uid AND cap_date = _today;
  UPDATE profiles SET love_points = love_points + _grant WHERE user_id = _uid;
  INSERT INTO love_point_transactions(user_id, action_type, points, related_type, related_id, description)
    VALUES (_uid, _action, _grant, _related_type, _related_id, _description);

  RETURN jsonb_build_object('success', true, 'granted', _grant, 'capped', _grant < _points);
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_love_points(
  _points INTEGER,
  _purpose TEXT,
  _related_type TEXT DEFAULT NULL,
  _related_id TEXT DEFAULT NULL,
  _description TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _balance INTEGER;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  IF _points <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_points'); END IF;

  SELECT love_points INTO _balance FROM profiles WHERE user_id = _uid FOR UPDATE;
  IF _balance < _points THEN RETURN jsonb_build_object('success', false, 'error', 'insufficient'); END IF;

  UPDATE profiles SET love_points = love_points - _points WHERE user_id = _uid;
  INSERT INTO love_point_transactions(user_id, action_type, points, related_type, related_id, description)
    VALUES (_uid, _purpose, -_points, _related_type, _related_id, _description);

  RETURN jsonb_build_object('success', true, 'remaining', _balance - _points);
END;
$$;

CREATE OR REPLACE FUNCTION public.donate_love_points(
  _points INTEGER,
  _target_type TEXT,
  _target_id UUID DEFAULT NULL,
  _message TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _balance INTEGER;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;
  IF _points <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_points'); END IF;
  IF _target_type NOT IN ('platform_pool','rescue_story') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_target');
  END IF;

  SELECT love_points INTO _balance FROM profiles WHERE user_id = _uid FOR UPDATE;
  IF _balance < _points THEN RETURN jsonb_build_object('success', false, 'error', 'insufficient'); END IF;

  UPDATE profiles SET love_points = love_points - _points WHERE user_id = _uid;
  INSERT INTO love_point_transactions(user_id, action_type, points, related_type, related_id, description)
    VALUES (_uid, 'donate', -_points, _target_type, _target_id::text, _message);
  INSERT INTO point_donations(user_id, points, target_type, target_id, message)
    VALUES (_uid, _points, _target_type, _target_id, _message);

  IF _target_type = 'rescue_story' AND _target_id IS NOT NULL THEN
    UPDATE rescue_stories
      SET cloud_feed_points = cloud_feed_points + _points,
          cloud_feed_count = cloud_feed_count + 1
      WHERE id = _target_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'remaining', _balance - _points);
END;
$$;

-- ===== 6. 种子兑换商品 =====
INSERT INTO public.point_redeemable_items(name, description, points_required, stock, category, sort_order) VALUES
  ('猫咪零食罐头 x 1', '进口主食罐，营养均衡', 500, 100, 'goods', 1),
  ('狗狗洁齿骨 x 5', '清洁牙齿，保护口腔', 800, 80, 'goods', 2),
  ('宠物玩具逗猫棒', '高弹力羽毛逗猫棒', 300, 200, 'goods', 3),
  ('10元商城无门槛券', '全场通用，30天有效', 1000, 500, 'coupon', 4),
  ('救助站定制周边 - 帆布包', '环保帆布袋，公益款', 2000, 30, 'goods', 5),
  ('"养宠达人"虚拟勋章', '炫耀型限量勋章', 1500, 999, 'virtual', 6);