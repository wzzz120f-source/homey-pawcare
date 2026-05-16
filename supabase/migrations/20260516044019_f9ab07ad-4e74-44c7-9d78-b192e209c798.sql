-- Fix: grant EXECUTE on SECURITY DEFINER helper functions to anon/authenticated
-- Root cause: many RLS policies call has_role() / is_merchant_owner(); without EXECUTE
-- permission, any query touching those policies fails with 42501.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_merchant_owner(uuid, uuid) TO anon, authenticated;

-- Harden the recommendation rules admin policy (split FOR ALL into IUD only,
-- so a plain SELECT by a normal user does not evaluate has_role at all).
DROP POLICY IF EXISTS "Admins manage rules" ON public.service_recommendation_rules;

CREATE POLICY "rules_admin_insert"
  ON public.service_recommendation_rules
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "rules_admin_update"
  ON public.service_recommendation_rules
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "rules_admin_delete"
  ON public.service_recommendation_rules
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));