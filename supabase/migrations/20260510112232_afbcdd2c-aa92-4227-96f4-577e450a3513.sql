
REVOKE EXECUTE ON FUNCTION public.is_admin_recently_authed(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_recently_authed(UUID) TO authenticated;
