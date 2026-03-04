
-- Create coupons table
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'fixed', -- 'fixed' or 'percent'
  discount_value NUMERIC NOT NULL DEFAULT 0,
  min_order_amount NUMERIC NOT NULL DEFAULT 0,
  max_discount NUMERIC, -- max discount for percent type
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  usage_limit INTEGER DEFAULT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coupons viewable by authenticated users"
ON public.coupons FOR SELECT TO authenticated
USING (is_active = true AND valid_until > now());

-- Create user_coupons table for claimed coupons
CREATE TABLE public.user_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMP WITH TIME ZONE,
  claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, coupon_id)
);

ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own coupons"
ON public.user_coupons FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can claim coupons"
ON public.user_coupons FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can use own coupons"
ON public.user_coupons FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- Insert sample coupons
INSERT INTO public.coupons (code, name, description, discount_type, discount_value, min_order_amount, max_discount, valid_until) VALUES
('NEW10', '新人专享', '新用户立减10元', 'fixed', 10, 50, NULL, '2026-12-31 23:59:59+08'),
('PET20', '宠物节', '全场满100减20', 'fixed', 20, 100, NULL, '2026-06-30 23:59:59+08'),
('VIP85', '会员折扣', '会员享85折优惠', 'percent', 15, 80, 50, '2026-12-31 23:59:59+08'),
('SPRING', '春季特惠', '春季满200减30', 'fixed', 30, 200, NULL, '2026-05-31 23:59:59+08');
