
REVOKE EXECUTE ON FUNCTION public.approve_driver_application(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_driver_application(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_commission(app_role, text, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.provider_request_withdrawal(numeric, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_approve_withdrawal(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_force_pay_withdrawal(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_withdrawal(uuid, text) FROM anon;
