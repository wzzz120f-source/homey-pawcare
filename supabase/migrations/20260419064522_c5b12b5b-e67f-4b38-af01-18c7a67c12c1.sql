
-- 1. 角色枚举
CREATE TYPE public.app_role AS ENUM ('admin', 'merchant', 'user');

-- 2. user_roles 表（避免在 profiles 上存角色，防止提权）
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. has_role security definer 函数
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- user_roles RLS：自己看自己的角色；只能由系统/管理员写
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. merchant_owners：用户与商家的多对多归属
CREATE TABLE public.merchant_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, user_id)
);
ALTER TABLE public.merchant_owners ENABLE ROW LEVEL SECURITY;

-- 5. is_merchant_owner 辅助函数
CREATE OR REPLACE FUNCTION public.is_merchant_owner(_user_id UUID, _merchant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchant_owners
    WHERE user_id = _user_id AND merchant_id = _merchant_id
  )
$$;

CREATE POLICY "Owners view own merchant link"
  ON public.merchant_owners FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage merchant owners"
  ON public.merchant_owners FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. products 表：补充商家管理用的 RLS（之前只有 SELECT）
CREATE POLICY "Merchant owners can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'merchant')
    AND public.is_merchant_owner(auth.uid(), merchant_id)
  );

CREATE POLICY "Merchant owners can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.is_merchant_owner(auth.uid(), merchant_id))
  WITH CHECK (public.is_merchant_owner(auth.uid(), merchant_id));

CREATE POLICY "Merchant owners can delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.is_merchant_owner(auth.uid(), merchant_id));

-- 7. merchants：商家可更新自己的资料
CREATE POLICY "Merchant owners can update merchant"
  ON public.merchants FOR UPDATE
  TO authenticated
  USING (public.is_merchant_owner(auth.uid(), id))
  WITH CHECK (public.is_merchant_owner(auth.uid(), id));

-- 8. 商家可查询自家订单（products.merchant_id 与 orders 暂无直接关联，本期仅暴露用户字段订单读取，预留）
-- orders 暂不增加策略：当前订单是用户视角的下单流水，与商家无直接 FK；商家订单视图可在第二版基于 order_items 拓展

-- 9. product-images storage：商家可写自家产品目录 {merchant_id}/...
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Merchant owners upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_merchant_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Merchant owners update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.is_merchant_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Merchant owners delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.is_merchant_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
