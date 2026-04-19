
-- ===== order_items =====
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  cover_image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_merchant ON public.order_items(merchant_id);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 买家可查看自己订单的商品
CREATE POLICY "Buyers view own order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()));

-- 商家查看自己店铺的订单商品
CREATE POLICY "Merchant owners view their order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (merchant_id IS NOT NULL AND public.is_merchant_owner(auth.uid(), merchant_id));

-- 买家在结账时为自己的订单写入明细
CREATE POLICY "Buyers insert own order items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()));

-- ===== merchant_applications =====
CREATE TABLE IF NOT EXISTS public.merchant_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  store_name TEXT NOT NULL,
  description TEXT,
  contact_name TEXT,
  contact_phone TEXT NOT NULL,
  address TEXT,
  license_number TEXT NOT NULL,
  license_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  review_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_merchant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_applications_user ON public.merchant_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_applications_status ON public.merchant_applications(status);

ALTER TABLE public.merchant_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own applications"
ON public.merchant_applications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own applications"
ON public.merchant_applications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins update applications"
ON public.merchant_applications
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_merchant_applications_updated
BEFORE UPDATE ON public.merchant_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Approval function =====
CREATE OR REPLACE FUNCTION public.approve_merchant_application(_application_id UUID, _note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin UUID := auth.uid();
  _app RECORD;
  _merchant_id UUID;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO _app FROM public.merchant_applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF _app.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_processed');
  END IF;

  INSERT INTO public.merchants(name, description, contact_phone, address, license_number, license_image_url, is_verified)
  VALUES (_app.store_name, _app.description, _app.contact_phone, _app.address, _app.license_number, _app.license_image_url, true)
  RETURNING id INTO _merchant_id;

  INSERT INTO public.merchant_owners(user_id, merchant_id) VALUES (_app.user_id, _merchant_id);

  INSERT INTO public.user_roles(user_id, role) VALUES (_app.user_id, 'merchant')
  ON CONFLICT DO NOTHING;

  UPDATE public.merchant_applications
  SET status = 'approved', reviewed_by = _admin, reviewed_at = now(),
      review_note = COALESCE(_note, review_note), created_merchant_id = _merchant_id
  WHERE id = _application_id;

  INSERT INTO public.notifications(user_id, title, content, type, related_id)
  VALUES (_app.user_id, '商家入驻申请已通过', '恭喜！您的店铺「' || _app.store_name || '」已通过审核，可在个人中心进入商家中心管理产品。', 'merchant', _merchant_id::text);

  RETURN jsonb_build_object('success', true, 'merchant_id', _merchant_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_merchant_application(_application_id UUID, _note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin UUID := auth.uid();
  _app RECORD;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO _app FROM public.merchant_applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF _app.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_processed');
  END IF;

  UPDATE public.merchant_applications
  SET status = 'rejected', reviewed_by = _admin, reviewed_at = now(), review_note = _note
  WHERE id = _application_id;

  INSERT INTO public.notifications(user_id, title, content, type, related_id)
  VALUES (_app.user_id, '商家入驻申请未通过', COALESCE(_note, '请完善材料后重新提交'), 'merchant', _application_id::text);

  RETURN jsonb_build_object('success', true);
END;
$$;
