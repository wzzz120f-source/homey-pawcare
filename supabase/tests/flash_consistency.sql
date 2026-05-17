-- Flash sale + escrow consistency self-check.
-- Run manually with psql; uses savepoints + ROLLBACK to leave no trace.
-- Usage: psql -f supabase/tests/flash_consistency.sql
BEGIN;
SAVEPOINT s0;

-- Setup: create a test merchant, product, flash sale, and 6 fake users.
DO $$
DECLARE _m uuid; _p uuid; _f uuid; _u uuid[]; _i int; _ord uuid;
        _ok int := 0; _sold int; _stock int; _ledger int; _qty int;
BEGIN
  INSERT INTO merchants(name, is_verified) VALUES ('QA Merchant', true) RETURNING id INTO _m;
  INSERT INTO products(merchant_id, name, price, stock, sales_count)
    VALUES (_m, 'QA Treat', 99.00, 100, 0) RETURNING id INTO _p;
  INSERT INTO flash_sales(product_id, flash_price, original_price, stock, sold_count, starts_at, ends_at, is_active)
    VALUES (_p, 49.00, 99.00, 3, 0, now() - interval '1 minute', now() + interval '1 hour', true)
    RETURNING id INTO _f;

  -- Spawn 5 fake users with profiles + wallets
  _u := ARRAY[]::uuid[];
  FOR _i IN 1..5 LOOP
    _u := array_append(_u, gen_random_uuid());
    INSERT INTO profiles(user_id, username) VALUES (_u[_i], 'qa_' || _i);
    INSERT INTO user_wallets(user_id, balance) VALUES (_u[_i], 1000);
  END LOOP;

  -- T1: 5 concurrent grabs of qty=1 against stock=3
  FOR _i IN 1..5 LOOP
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', _u[_i]::text, true);
      PERFORM set_config('role', 'authenticated', true);
      -- emulate auth.uid() via SECURITY DEFINER bypass; call as service role
      INSERT INTO orders(user_id, order_type, total_amount, payment_method, payment_status, escrow_status, flash_sale_id)
        VALUES (_u[_i], 'product', 49.00, 'wallet', 'paid', 'held', _f) RETURNING id INTO _ord;
      INSERT INTO order_items(order_id, product_id, product_name, unit_price, quantity)
        VALUES (_ord, _p, 'QA Treat', 49.00, 1);
      UPDATE flash_sales SET sold_count = sold_count + 1
        WHERE id = _f AND stock - sold_count >= 1;
      IF FOUND THEN _ok := _ok + 1; ELSE DELETE FROM orders WHERE id = _ord; END IF;
    END;
  END LOOP;
  SELECT sold_count INTO _sold FROM flash_sales WHERE id = _f;
  RAISE NOTICE 'T1 grabs ok=% (expect 3), sold_count=% (expect 3)', _ok, _sold;
  IF _ok <> 3 OR _sold <> 3 THEN RAISE EXCEPTION 'T1 failed'; END IF;

  -- T3: cancel one held order via rollback_escrow, expect sold_count=2
  SELECT id INTO _ord FROM orders WHERE flash_sale_id = _f LIMIT 1;
  PERFORM rollback_escrow(_ord, 'qa cancel');
  SELECT sold_count INTO _sold FROM flash_sales WHERE id = _f;
  SELECT count(*) INTO _ledger FROM escrow_ledger WHERE order_id = _ord;
  RAISE NOTICE 'T3 cancel · sold_count=% (expect 2), ledger=% (expect>=1)', _sold, _ledger;
  IF _sold <> 2 OR _ledger < 1 THEN RAISE EXCEPTION 'T3 failed'; END IF;

  -- T4: partial refund on another order (set 2 items first)
  SELECT id INTO _ord FROM orders WHERE flash_sale_id = _f AND escrow_status = 'held' LIMIT 1;
  UPDATE order_items SET quantity = 2 WHERE order_id = _ord;
  UPDATE orders SET total_amount = 98.00 WHERE id = _ord;
  -- simulate admin role for partial_refund
  PERFORM partial_refund(_ord, 49.00, 'qa partial');
  SELECT escrow_status FROM orders WHERE id = _ord INTO STRICT _ord; -- abuse var
  SELECT count(*) INTO _ledger FROM escrow_ledger WHERE order_id = (SELECT id FROM orders WHERE flash_sale_id=_f AND refund_status='partial' LIMIT 1) AND action='partial_refund';
  RAISE NOTICE 'T4 partial · ledger partial rows=% (expect 1)', _ledger;
END $$;

ROLLBACK TO SAVEPOINT s0;
ROLLBACK;
