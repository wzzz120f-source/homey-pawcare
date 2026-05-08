-- companion_reports: 绑定到订单的陪伴报告
CREATE TABLE IF NOT EXISTS public.companion_reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null,
  actions text[] not null default '{}',
  extra text,
  photo_url text,
  diary text,
  poster_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id)
);

CREATE INDEX IF NOT EXISTS idx_companion_reports_order ON public.companion_reports(order_id);

ALTER TABLE public.companion_reports ENABLE ROW LEVEL SECURITY;

-- 订单的客户、司机、admin 可读
CREATE POLICY "companion_reports_select_related" ON public.companion_reports
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = companion_reports.order_id
      AND (o.user_id = auth.uid() OR o.driver_id = auth.uid())
  )
);

-- 守护者（订单 driver）或客户本人可写
CREATE POLICY "companion_reports_insert_related" ON public.companion_reports
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
      AND (o.user_id = auth.uid() OR o.driver_id = auth.uid())
  )
);

CREATE POLICY "companion_reports_update_owner" ON public.companion_reports
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_companion_reports_updated_at
BEFORE UPDATE ON public.companion_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();