
-- Tighten review-media RLS for companion report assets
-- Existing: any authed user can INSERT to bucket; SELECT public; no UPDATE/DELETE.
-- Goal: companion-report uploads must live under companion/<uid>/... or companion-poster/<uid>/...
--       and only that uid can update/delete them. Other reviewers' uploads keep current rules.

DROP POLICY IF EXISTS "Authenticated users can upload review media" ON storage.objects;

CREATE POLICY "review_media_insert_scoped"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'review-media'
  AND (
    -- companion report assets: enforce uid as 2nd path segment
    (
      (storage.foldername(name))[1] IN ('companion','companion-poster')
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
    OR
    -- legacy / generic review uploads (other features): keep authed-only
    (storage.foldername(name))[1] NOT IN ('companion','companion-poster')
  )
);

CREATE POLICY "review_media_update_owner"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'review-media'
  AND (storage.foldername(name))[1] IN ('companion','companion-poster')
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'review-media'
  AND (storage.foldername(name))[1] IN ('companion','companion-poster')
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "review_media_delete_owner_or_order_owner"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'review-media'
  AND (storage.foldername(name))[1] IN ('companion','companion-poster')
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.companion_reports cr
      JOIN public.orders o ON o.id = cr.order_id
      WHERE o.user_id = auth.uid()
        AND (cr.photo_url LIKE '%' || name OR cr.poster_url LIKE '%' || name)
    )
  )
);

-- Tighten companion_reports.UPDATE so it also requires order relation (not only user_id)
DROP POLICY IF EXISTS companion_reports_update_owner ON public.companion_reports;
CREATE POLICY companion_reports_update_owner
ON public.companion_reports FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = companion_reports.order_id
      AND (o.user_id = auth.uid() OR o.driver_id = auth.uid())
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = companion_reports.order_id
      AND (o.user_id = auth.uid() OR o.driver_id = auth.uid())
  )
);
