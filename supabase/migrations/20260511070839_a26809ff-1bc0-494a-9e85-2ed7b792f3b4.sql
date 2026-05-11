
-- ====== rescue_kyc ======
CREATE TABLE IF NOT EXISTS public.rescue_kyc (
  user_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  real_name text NOT NULL,
  id_card_no_hash text NOT NULL,
  id_card_last4 text,
  id_card_front_url text NOT NULL,
  id_card_back_url text NOT NULL,
  hold_id_url text NOT NULL,
  bank_account_name text NOT NULL,
  bank_account_no text NOT NULL,
  bank_name text NOT NULL,
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rescue_kyc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kyc_self_select" ON public.rescue_kyc FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "kyc_self_insert" ON public.rescue_kyc FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kyc_self_update" ON public.rescue_kyc FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_rescue_kyc_updated BEFORE UPDATE ON public.rescue_kyc
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== post_product_links ======
CREATE TABLE IF NOT EXISTS public.post_product_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_ppl_post ON public.post_product_links(post_id);
ALTER TABLE public.post_product_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppl_select_all" ON public.post_product_links FOR SELECT USING (true);
CREATE POLICY "ppl_author_insert" ON public.post_product_links FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));
CREATE POLICY "ppl_author_delete" ON public.post_product_links FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));

-- ====== Storage: kyc-documents (private) ======
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents','kyc-documents', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "kyc_obj_self_read" ON storage.objects FOR SELECT
  USING (bucket_id='kyc-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "kyc_obj_self_write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id='kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "kyc_obj_self_update" ON storage.objects FOR UPDATE
  USING (bucket_id='kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "kyc_obj_self_delete" ON storage.objects FOR DELETE
  USING (bucket_id='kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ====== submit_rescue_kyc RPC ======
CREATE OR REPLACE FUNCTION public.submit_rescue_kyc(
  _real_name text, _id_card_no text,
  _front_url text, _back_url text, _hold_url text,
  _bank_account_name text, _bank_account_no text, _bank_name text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _existing RECORD; _hash text; _last4 text;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','unauthorized'); END IF;
  IF _real_name IS NULL OR length(trim(_real_name)) < 2 THEN
    RETURN jsonb_build_object('success',false,'error','invalid_real_name'); END IF;
  IF _id_card_no IS NULL OR length(_id_card_no) < 8 THEN
    RETURN jsonb_build_object('success',false,'error','invalid_id_card'); END IF;
  IF _bank_account_no IS NULL OR length(_bank_account_no) < 8 THEN
    RETURN jsonb_build_object('success',false,'error','invalid_bank_account'); END IF;

  _hash := encode(digest(_id_card_no, 'sha256'), 'hex');
  _last4 := right(_id_card_no, 4);

  SELECT * INTO _existing FROM public.rescue_kyc WHERE user_id = _uid;
  IF FOUND THEN
    IF _existing.status = 'approved' THEN
      RETURN jsonb_build_object('success',false,'error','already_approved');
    END IF;
    UPDATE public.rescue_kyc SET
      status='pending', real_name=_real_name, id_card_no_hash=_hash, id_card_last4=_last4,
      id_card_front_url=_front_url, id_card_back_url=_back_url, hold_id_url=_hold_url,
      bank_account_name=_bank_account_name, bank_account_no=_bank_account_no, bank_name=_bank_name,
      review_note=NULL, reviewed_by=NULL, reviewed_at=NULL, submitted_at=now(), updated_at=now()
      WHERE user_id = _uid;
  ELSE
    INSERT INTO public.rescue_kyc(user_id,real_name,id_card_no_hash,id_card_last4,
      id_card_front_url,id_card_back_url,hold_id_url,
      bank_account_name,bank_account_no,bank_name)
      VALUES (_uid,_real_name,_hash,_last4,_front_url,_back_url,_hold_url,
        _bank_account_name,_bank_account_no,_bank_name);
  END IF;
  RETURN jsonb_build_object('success',true);
END $$;

-- ====== admin_review_rescue_kyc RPC ======
CREATE OR REPLACE FUNCTION public.admin_review_rescue_kyc(_uid uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := auth.uid();
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin,'admin') THEN
    RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;
  UPDATE public.rescue_kyc
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
        review_note = _note, reviewed_by = _admin, reviewed_at = now(), updated_at = now()
    WHERE user_id = _uid;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  INSERT INTO public.notifications(user_id,title,content,type,related_id)
    VALUES (_uid,
      CASE WHEN _approve THEN '提现实名认证已通过' ELSE '提现实名认证未通过' END,
      CASE WHEN _approve THEN '你的实名认证已通过，现在可以申请提现救助资金。'
           ELSE '认证未通过：' || COALESCE(_note,'请重新提交准确的实名信息与证件。') END,
      'order', _uid::text);
  PERFORM public.log_admin_action(
    CASE WHEN _approve THEN 'rescue_kyc_approved' ELSE 'rescue_kyc_rejected' END,
    'rescue_kyc', _uid::text, jsonb_build_object('note',_note));
  RETURN jsonb_build_object('success',true);
END $$;

-- ====== request_withdrawal_v2: provider 提现 + KYC 校验 ======
CREATE OR REPLACE FUNCTION public.request_withdrawal_v2(_amount numeric, _bank_info jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _has_feed boolean; _kyc RECORD; _payout_name text;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','unauthorized'); END IF;

  SELECT EXISTS(SELECT 1 FROM public.wallet_transactions
    WHERE user_id = _uid AND type = 'feed_in') INTO _has_feed;

  IF _has_feed THEN
    SELECT * INTO _kyc FROM public.rescue_kyc WHERE user_id = _uid;
    IF NOT FOUND OR _kyc.status <> 'approved' THEN
      RETURN jsonb_build_object('success',false,'error','kyc_required',
        'status', COALESCE(_kyc.status,'none'));
    END IF;
    _payout_name := COALESCE(_bank_info->>'account_name', '');
    IF _payout_name <> '' AND _payout_name <> _kyc.bank_account_name THEN
      RETURN jsonb_build_object('success',false,'error','name_mismatch');
    END IF;
  END IF;

  RETURN public.provider_request_withdrawal(_amount, _bank_info);
END $$;

-- ====== Patch admin_approve_withdrawal: 增加 KYC + name flags ======
CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal(_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $function$
DECLARE _admin uuid := auth.uid(); _w RECORD; _flags text[] := '{}'; _recent integer; _self_orders integer; _has_feed boolean; _kyc RECORD; _payout_name text;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin,'admin') THEN
    RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;
  SELECT * INTO _w FROM public.withdrawal_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF _w.status <> 'pending' THEN RETURN jsonb_build_object('success',false,'error','already_processed'); END IF;
  SELECT count(*) INTO _recent FROM public.withdrawal_requests
    WHERE user_id = _w.user_id AND requested_at > now() - interval '24 hours';
  IF _recent >= 3 THEN _flags := array_append(_flags,'frequent_24h'); END IF;
  IF _w.amount > 5000 THEN _flags := array_append(_flags,'large_amount'); END IF;
  SELECT count(*) INTO _self_orders FROM public.orders
    WHERE driver_id = _w.user_id AND user_id = _w.user_id;
  IF _self_orders > 0 THEN _flags := array_append(_flags,'self_dealing'); END IF;

  -- KYC + name checks for users with feed_in funds
  SELECT EXISTS(SELECT 1 FROM public.wallet_transactions WHERE user_id = _w.user_id AND type='feed_in') INTO _has_feed;
  IF _has_feed THEN
    SELECT * INTO _kyc FROM public.rescue_kyc WHERE user_id = _w.user_id;
    IF NOT FOUND OR _kyc.status <> 'approved' THEN
      _flags := array_append(_flags,'feed_funds_no_kyc');
    ELSE
      _payout_name := COALESCE(_w.bank_info->>'account_name','');
      IF _payout_name <> '' AND _payout_name <> _kyc.bank_account_name THEN
        _flags := array_append(_flags,'payout_name_mismatch');
      END IF;
    END IF;
  END IF;

  IF array_length(_flags,1) > 0 THEN
    UPDATE public.withdrawal_requests SET status='flagged', risk_flags=_flags, reviewed_by=_admin, reviewed_at=now() WHERE id=_id;
    PERFORM public.log_admin_action('withdrawal_flagged','withdrawal',_id::text, jsonb_build_object('amount',_w.amount,'risk_flags',_flags));
    RETURN jsonb_build_object('success',true,'flagged',true,'risk_flags',_flags);
  END IF;
  UPDATE public.provider_balances SET frozen = frozen - _w.amount, withdrawn_total = withdrawn_total + _w.amount, updated_at=now() WHERE user_id = _w.user_id;
  UPDATE public.withdrawal_requests
    SET status='paid', reviewed_by=_admin, reviewed_at=now(), paid_at=now(),
        voucher_no = 'PAY' || to_char(now(),'YYYYMMDD') || substr(replace(_id::text,'-',''),1,6)
    WHERE id=_id;
  INSERT INTO public.notifications(user_id,title,content,type,related_id)
    VALUES (_w.user_id,'提现已到账','金额 '|| _w.actual_amount ||' 元已发放','order',_id::text);
  PERFORM public.log_admin_action('withdrawal_approved','withdrawal',_id::text, jsonb_build_object('amount',_w.amount,'actual',_w.actual_amount));
  RETURN jsonb_build_object('success',true,'flagged',false);
END;
$function$;
