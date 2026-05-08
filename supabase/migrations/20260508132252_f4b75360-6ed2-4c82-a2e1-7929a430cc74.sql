-- Allow report owner / order owner to clear their companion report
CREATE POLICY "companion_reports_delete_owner" ON public.companion_reports
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = companion_reports.order_id
      AND o.user_id = auth.uid()
  )
);