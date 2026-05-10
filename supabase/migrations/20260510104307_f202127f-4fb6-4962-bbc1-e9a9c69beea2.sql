
REVOKE EXECUTE ON FUNCTION public.create_payment_intent(uuid,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_payment_succeeded(uuid,text,numeric,jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_payment_failed(uuid,jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_refund(uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_refund(uuid,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.close_expired_payments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_payment_intent(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_refund(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_refund(uuid,text,text) TO authenticated;
-- mark_payment_*, close_expired_payments：仅供 service_role webhook 调用
GRANT EXECUTE ON FUNCTION public.mark_payment_succeeded(uuid,text,numeric,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_payment_failed(uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_expired_payments() TO service_role;
