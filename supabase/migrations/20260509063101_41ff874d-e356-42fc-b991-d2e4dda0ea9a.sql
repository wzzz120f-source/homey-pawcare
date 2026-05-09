
-- Trigger / internal-only SECURITY DEFINER functions: revoke from everyone
DO $$
DECLARE
  fn TEXT;
  internal_fns TEXT[] := ARRAY[
    'public.handle_new_user()',
    'public.grant_points_on_like()',
    'public.notify_comment_mentions()',
    'public.notify_order_status_change()',
    'public.validate_trip_tracking_driver()',
    'public.has_role(uuid, app_role)',
    'public.is_merchant_owner(uuid, uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY internal_fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
  END LOOP;
END $$;

-- Frontend-callable RPCs: revoke from PUBLIC/anon, grant only authenticated
DO $$
DECLARE
  fn TEXT;
  rpc_fns TEXT[] := ARRAY[
    'public.award_love_points(text, integer, text, text, text)',
    'public.spend_love_points(integer, text, text, text, text)',
    'public.donate_love_points(integer, text, uuid, text)',
    'public.get_product_review_stats()',
    'public.approve_merchant_application(uuid, text)',
    'public.reject_merchant_application(uuid, text)'
  ];
BEGIN
  FOREACH fn IN ARRAY rpc_fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;
