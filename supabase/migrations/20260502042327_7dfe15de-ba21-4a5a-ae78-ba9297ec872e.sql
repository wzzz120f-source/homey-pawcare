-- ============ 1. 推荐规则表 ============
CREATE TABLE public.service_recommendation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_type TEXT,
  breed_keywords TEXT[] DEFAULT '{}',
  age_min_months INTEGER,
  age_max_months INTEGER,
  service_id TEXT NOT NULL,
  service_title TEXT NOT NULL,
  service_emoji TEXT DEFAULT '🐾',
  reason_text TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_recommendation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active rules viewable by everyone"
  ON public.service_recommendation_rules FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage rules"
  ON public.service_recommendation_rules FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_recommendation_rules_updated
  BEFORE UPDATE ON public.service_recommendation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 种子数据
INSERT INTO public.service_recommendation_rules (pet_type, breed_keywords, age_min_months, age_max_months, service_id, service_title, service_emoji, reason_text, priority) VALUES
  ('dog', ARRAY['萨摩耶','金毛','哈士奇','阿拉斯加','边牧','大白熊'], NULL, NULL, 'bath', '大狗深度SPA', '🛁', '大型犬掉毛多，建议每 2 周深度洗护', 90),
  ('dog', ARRAY['萨摩耶','金毛','边牧'], NULL, NULL, 'grooming', '掉毛季去毛护理', '✂️', '换毛季毛量爆炸，专业脱毛护理减少 80%', 85),
  ('cat', ARRAY[]::text[], 0, 6, 'health', '幼猫疫苗上门', '💉', '3-6 月龄是疫苗黄金期，免去出门应激', 95),
  ('dog', ARRAY[]::text[], 0, 8, 'health', '幼犬体检套餐', '🩺', '幼犬建议每月一次健康检查', 88),
  ('dog', ARRAY['泰迪','比熊','贵宾','雪纳瑞'], NULL, NULL, 'grooming', '小型犬精致美容', '✨', '小型犬定期造型更萌更易打理', 80),
  ('cat', ARRAY[]::text[], 12, NULL, 'walking', '猫咪上门陪伴', '🐾', '成年猫独处易焦虑，定期陪伴更健康', 70);

-- ============ 2. 服务时间轴 ============
CREATE TABLE public.service_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  technician_id UUID,
  event_type TEXT NOT NULL,
  description TEXT,
  media_url TEXT,
  media_type TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_timeline_events_order ON public.service_timeline_events(order_id, occurred_at DESC);

ALTER TABLE public.service_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order owner views timeline"
  ON public.service_timeline_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR o.driver_id = auth.uid()))
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Technician inserts timeline"
  ON public.service_timeline_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.driver_id = auth.uid())
    OR has_role(auth.uid(), 'admin')
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.service_timeline_events;
ALTER TABLE public.service_timeline_events REPLICA IDENTITY FULL;

-- ============ 3. 邻里拼单 ============
CREATE TABLE public.group_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id UUID NOT NULL,
  service_date DATE NOT NULL,
  service_type TEXT,
  technician_id UUID,
  community_name TEXT NOT NULL,
  address_summary TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  member_count INTEGER NOT NULL DEFAULT 1,
  target_count INTEGER NOT NULL DEFAULT 3,
  discount_per_member NUMERIC NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'recruiting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_orders_date_status ON public.group_orders(service_date, status);

ALTER TABLE public.group_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiting groups viewable by all auth"
  ON public.group_orders FOR SELECT
  TO authenticated
  USING (status IN ('recruiting','formed') OR initiator_id = auth.uid());

CREATE POLICY "Users create own groups"
  ON public.group_orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = initiator_id);

CREATE POLICY "Initiator updates own group"
  ON public.group_orders FOR UPDATE
  TO authenticated
  USING (auth.uid() = initiator_id)
  WITH CHECK (auth.uid() = initiator_id);

CREATE TRIGGER trg_group_orders_updated
  BEFORE UPDATE ON public.group_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 拼单成员
CREATE TABLE public.group_order_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.group_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  order_id UUID,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.group_order_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members viewable by participants"
  ON public.group_order_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.group_orders g WHERE g.id = group_id AND g.initiator_id = auth.uid())
  );

CREATE POLICY "Users join groups themselves"
  ON public.group_order_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users leave own membership"
  ON public.group_order_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 自动维护 member_count + 状态
CREATE OR REPLACE FUNCTION public.refresh_group_order_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _gid UUID;
  _cnt INTEGER;
  _target INTEGER;
BEGIN
  _gid := COALESCE(NEW.group_id, OLD.group_id);
  SELECT COUNT(*) INTO _cnt FROM public.group_order_members WHERE group_id = _gid;
  SELECT target_count INTO _target FROM public.group_orders WHERE id = _gid;
  UPDATE public.group_orders
    SET member_count = _cnt,
        status = CASE WHEN _cnt >= _target THEN 'formed' ELSE 'recruiting' END,
        updated_at = now()
    WHERE id = _gid;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_group_member_change
  AFTER INSERT OR DELETE ON public.group_order_members
  FOR EACH ROW EXECUTE FUNCTION public.refresh_group_order_count();