
-- 1) user_roles metadata + self update policy
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DROP POLICY IF EXISTS "Users update own role metadata" ON public.user_roles;
CREATE POLICY "Users update own role metadata"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2) Storage: drop broad public listing policies (public URL access still works for public buckets)
DROP POLICY IF EXISTS "Anyone can view community media" ON storage.objects;
DROP POLICY IF EXISTS "Hotel review images publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Lost pet media public read" ON storage.objects;
DROP POLICY IF EXISTS "Product images publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
DROP POLICY IF EXISTS "Rescue media public read" ON storage.objects;
DROP POLICY IF EXISTS "Review media publicly accessible" ON storage.objects;

-- 3) Lock down SECURITY DEFINER functions: revoke from PUBLIC/anon, grant to authenticated only where needed
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.args);
  END LOOP;
END$$;

-- Grant EXECUTE only to authenticated for RPCs / RLS helpers actually called from app context
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_merchant_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_love_points(text, integer, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_love_points(integer, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.donate_love_points(integer, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_merchant_application(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_merchant_application(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_review_stats() TO authenticated, anon;
