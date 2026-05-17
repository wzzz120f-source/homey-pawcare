-- Merchant owners can manage flash sales for their own products
CREATE OR REPLACE FUNCTION public.is_merchant_owner_of_product(_user_id uuid, _product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.merchant_owners mo ON mo.merchant_id = p.merchant_id
    WHERE p.id = _product_id AND mo.user_id = _user_id
  );
$$;

CREATE POLICY "flash_sales_merchant_insert"
ON public.flash_sales FOR INSERT TO authenticated
WITH CHECK (public.is_merchant_owner_of_product(auth.uid(), product_id));

CREATE POLICY "flash_sales_merchant_update"
ON public.flash_sales FOR UPDATE TO authenticated
USING (public.is_merchant_owner_of_product(auth.uid(), product_id))
WITH CHECK (public.is_merchant_owner_of_product(auth.uid(), product_id));

CREATE POLICY "flash_sales_merchant_delete"
ON public.flash_sales FOR DELETE TO authenticated
USING (public.is_merchant_owner_of_product(auth.uid(), product_id));

-- Allow merchant owners to see their own (active/inactive) flash sales
CREATE POLICY "flash_sales_merchant_select"
ON public.flash_sales FOR SELECT TO authenticated
USING (public.is_merchant_owner_of_product(auth.uid(), product_id));