
-- ============ 1. 收货地址簿 ============
CREATE TABLE public.shipping_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recipient text NOT NULL,
  phone text NOT NULL,
  province text NOT NULL,
  city text NOT NULL,
  district text NOT NULL,
  detail text NOT NULL,
  postal_code text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shipping_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addr_self_all" ON public.shipping_addresses FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_addr_user ON public.shipping_addresses(user_id);

CREATE OR REPLACE FUNCTION public.ensure_single_default_address()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.shipping_addresses SET is_default = false
      WHERE user_id = NEW.user_id AND id <> NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_addr_single_default
AFTER INSERT OR UPDATE OF is_default ON public.shipping_addresses
FOR EACH ROW WHEN (NEW.is_default) EXECUTE FUNCTION public.ensure_single_default_address();

CREATE TRIGGER trg_addr_updated_at BEFORE UPDATE ON public.shipping_addresses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_address_snapshot jsonb;

-- ============ 2. 酒店房型 ============
CREATE TABLE public.hotel_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL,
  room_type text NOT NULL,
  name text NOT NULL,
  capacity integer NOT NULL DEFAULT 1,
  base_price numeric NOT NULL DEFAULT 0,
  amenities text[] NOT NULL DEFAULT '{}',
  image_url text,
  stock integer NOT NULL DEFAULT 5,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hotel_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hotel_rooms_public_read" ON public.hotel_rooms FOR SELECT TO public USING (is_active = true);
CREATE POLICY "hotel_rooms_admin_write" ON public.hotel_rooms FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE INDEX idx_hotel_rooms_hotel ON public.hotel_rooms(hotel_id);

INSERT INTO public.hotel_rooms (hotel_id, room_type, name, capacity, base_price, amenities, sort_order, description)
SELECT h.id, 'standard', '标准单宠房', 1, h.price_min, ARRAY['空调','监控','每日清洁'], 0, '适合小型犬/猫'
FROM public.pet_hotels h WHERE h.is_active = true;
INSERT INTO public.hotel_rooms (hotel_id, room_type, name, capacity, base_price, amenities, sort_order, description)
SELECT h.id, 'deluxe', '豪华双宠房', 2, ROUND((h.price_min + h.price_max)/2)::numeric, ARRAY['空调','监控','活动区','每日洗护'], 1, '空间更大，适合两只宠物'
FROM public.pet_hotels h WHERE h.is_active = true;
INSERT INTO public.hotel_rooms (hotel_id, room_type, name, capacity, base_price, amenities, sort_order, description)
SELECT h.id, 'vip', 'VIP套房', 3, h.price_max, ARRAY['独立空间','私人管家','24h监控','宠物SPA'], 2, '专属管家服务'
FROM public.pet_hotels h WHERE h.is_active = true;

-- ============ 3. 服务打卡 ============
CREATE TABLE public.service_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action_key text NOT NULL,
  photo_url text NOT NULL,
  lat double precision,
  lng double precision,
  exif_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_checkins ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_checkins_order ON public.service_checkins(order_id);
CREATE POLICY "checkin_insert_provider" ON public.service_checkins FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.driver_id = auth.uid()));
CREATE POLICY "checkin_select_related" ON public.service_checkins FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR o.driver_id = auth.uid())));

INSERT INTO storage.buckets (id, name, public) VALUES ('service-checkins', 'service-checkins', true)
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "checkin_bucket_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'service-checkins');
CREATE POLICY "checkin_bucket_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'service-checkins' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE OR REPLACE FUNCTION public.complete_service_order(_order_id uuid, _required text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _o RECORD; _missing text[];
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  IF _o.driver_id <> auth.uid() THEN RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;
  IF _required IS NOT NULL AND array_length(_required,1) > 0 THEN
    SELECT array_agg(r) INTO _missing FROM unnest(_required) r
      WHERE NOT EXISTS (SELECT 1 FROM public.service_checkins c WHERE c.order_id = _order_id AND c.action_key = r);
    IF _missing IS NOT NULL AND array_length(_missing,1) > 0 THEN
      RETURN jsonb_build_object('success',false,'error','checkin_incomplete','missing',_missing);
    END IF;
  END IF;
  UPDATE public.orders SET order_status = 'completed', updated_at = now() WHERE id = _order_id;
  RETURN jsonb_build_object('success',true);
END $$;

CREATE OR REPLACE FUNCTION public.driver_grab_order(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid(); _updated integer;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','unauthorized'); END IF;
  IF NOT (has_role(_uid,'driver') OR has_role(_uid,'sitter') OR has_role(_uid,'groomer')) THEN
    RETURN jsonb_build_object('success',false,'error','not_a_provider');
  END IF;
  UPDATE public.orders SET driver_id = _uid, order_status = 'accepted', updated_at = now()
    WHERE id = _order_id AND driver_id IS NULL AND order_status IN ('pending','created');
  GET DIAGNOSTICS _updated = ROW_COUNT;
  IF _updated = 0 THEN RETURN jsonb_build_object('success',false,'error','already_taken'); END IF;
  RETURN jsonb_build_object('success',true);
END $$;

-- ============ 4. 钱包 ============
CREATE TABLE public.user_wallets (
  user_id uuid PRIMARY KEY,
  balance numeric NOT NULL DEFAULT 0,
  frozen numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_self_or_admin" ON public.user_wallets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  amount numeric NOT NULL,
  balance_after numeric NOT NULL DEFAULT 0,
  related_order_id uuid,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_tx_self_or_admin" ON public.wallet_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE INDEX idx_wallet_tx_user ON public.wallet_transactions(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.wallet_recharge(_amount numeric, _channel text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid(); _new numeric;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','unauthorized'); END IF;
  IF _amount <= 0 THEN RETURN jsonb_build_object('success',false,'error','invalid_amount'); END IF;
  INSERT INTO public.user_wallets(user_id, balance) VALUES (_uid, _amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.user_wallets.balance + _amount, updated_at = now()
    RETURNING balance INTO _new;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, description)
    VALUES (_uid, 'recharge', _amount, _new, COALESCE(_channel,'未知')||' 充值');
  RETURN jsonb_build_object('success',true,'balance',_new);
END $$;

CREATE OR REPLACE FUNCTION public.wallet_pay(_amount numeric, _order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid(); _bal numeric; _new numeric;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','unauthorized'); END IF;
  IF _amount <= 0 THEN RETURN jsonb_build_object('success',false,'error','invalid_amount'); END IF;
  SELECT balance INTO _bal FROM public.user_wallets WHERE user_id = _uid FOR UPDATE;
  IF NOT FOUND OR _bal < _amount THEN RETURN jsonb_build_object('success',false,'error','insufficient'); END IF;
  UPDATE public.user_wallets SET balance = balance - _amount, updated_at = now() WHERE user_id = _uid RETURNING balance INTO _new;
  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_after, related_order_id, description)
    VALUES (_uid, 'pay', -_amount, _new, _order_id, '订单支付');
  RETURN jsonb_build_object('success',true,'balance',_new);
END $$;

-- ============ 5. IM 扩展 ============
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS peer_id uuid,
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS last_message text,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS unread_user integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unread_peer integer NOT NULL DEFAULT 0;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS duration_sec integer,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS location_address text,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

DROP POLICY IF EXISTS "Users can view own conversations" ON public.chat_conversations;
CREATE POLICY "chat_conv_participants_select" ON public.chat_conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = peer_id);

DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.chat_messages;
CREATE POLICY "chat_msg_participants_select" ON public.chat_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_conversations c
    WHERE c.id = conversation_id AND (c.user_id = auth.uid() OR c.peer_id = auth.uid())));

DROP POLICY IF EXISTS "Users can send messages in own conversations" ON public.chat_messages;
CREATE POLICY "chat_msg_participants_insert" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND
    EXISTS (SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id AND (c.user_id = auth.uid() OR c.peer_id = auth.uid())));

CREATE POLICY "chat_msg_participants_update_read" ON public.chat_messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_conversations c
    WHERE c.id = conversation_id AND (c.user_id = auth.uid() OR c.peer_id = auth.uid())));

CREATE OR REPLACE FUNCTION public.bump_conversation_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _conv RECORD; _preview text;
BEGIN
  SELECT * INTO _conv FROM public.chat_conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  _preview := CASE NEW.message_type
    WHEN 'image' THEN '[图片]'
    WHEN 'voice' THEN '[语音]'
    WHEN 'location' THEN '[位置]'
    ELSE LEFT(NEW.content, 60)
  END;
  IF NEW.sender_id = _conv.user_id THEN
    UPDATE public.chat_conversations
      SET last_message = _preview, last_message_at = NEW.created_at,
          unread_peer = unread_peer + 1, updated_at = now()
      WHERE id = NEW.conversation_id;
  ELSE
    UPDATE public.chat_conversations
      SET last_message = _preview, last_message_at = NEW.created_at,
          unread_user = unread_user + 1, updated_at = now()
      WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bump_conversation ON public.chat_messages;
CREATE TRIGGER trg_bump_conversation AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_on_message();

CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conv_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid(); _conv RECORD;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success',false); END IF;
  SELECT * INTO _conv FROM public.chat_conversations WHERE id = _conv_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false); END IF;
  IF _uid = _conv.user_id THEN
    UPDATE public.chat_conversations SET unread_user = 0 WHERE id = _conv_id;
  ELSIF _uid = _conv.peer_id THEN
    UPDATE public.chat_conversations SET unread_peer = 0 WHERE id = _conv_id;
  ELSE RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;
  UPDATE public.chat_messages SET read_at = now()
    WHERE conversation_id = _conv_id AND sender_id <> _uid AND read_at IS NULL;
  RETURN jsonb_build_object('success',true);
END $$;

CREATE OR REPLACE FUNCTION public.start_conversation(_peer_id uuid, _order_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL OR _peer_id IS NULL OR _uid = _peer_id THEN RETURN NULL; END IF;
  SELECT id INTO _id FROM public.chat_conversations
    WHERE ((user_id=_uid AND peer_id=_peer_id) OR (user_id=_peer_id AND peer_id=_uid))
    LIMIT 1;
  IF _id IS NOT NULL THEN
    IF _order_id IS NOT NULL THEN UPDATE public.chat_conversations SET order_id = _order_id WHERE id = _id; END IF;
    RETURN _id;
  END IF;
  INSERT INTO public.chat_conversations(user_id, peer_id, order_id)
    VALUES (_uid, _peer_id, _order_id) RETURNING id INTO _id;
  RETURN _id;
END $$;

-- Realtime（service_checkins 与 chat_conversations 加入；chat_messages 已存在，跳过）
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.service_checkins; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- chat-media 桶
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "chat_media_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'chat-media');
CREATE POLICY "chat_media_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============ 6. 洗护评价 ============
CREATE TABLE public.groomer_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  groomer_id uuid NOT NULL,
  overall integer NOT NULL DEFAULT 5,
  technique integer NOT NULL DEFAULT 5,
  gentleness integer NOT NULL DEFAULT 5,
  pet_stress_level integer NOT NULL DEFAULT 1,
  env_clean integer NOT NULL DEFAULT 5,
  tags text[] NOT NULL DEFAULT '{}',
  content text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.groomer_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groomer_ratings_public_read" ON public.groomer_ratings FOR SELECT TO public USING (true);
CREATE POLICY "groomer_ratings_owner_insert" ON public.groomer_ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
