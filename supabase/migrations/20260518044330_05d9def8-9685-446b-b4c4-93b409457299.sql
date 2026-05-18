-- 1. service_type 归一函数
CREATE OR REPLACE FUNCTION public.canonical_service_type(_t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE LOWER(COALESCE(_t,''))
    WHEN 'bath' THEN 'groom'
    WHEN 'grooming' THEN 'groom'
    WHEN 'health' THEN 'groom'
    WHEN 'groom' THEN 'groom'
    WHEN 'walking' THEN 'walk'
    WHEN 'walk' THEN 'walk'
    WHEN 'home' THEN 'feed'
    WHEN 'feed' THEN 'feed'
    WHEN 'pickup' THEN 'pickup'
    WHEN 'delivery' THEN 'delivery'
    WHEN 'hotel' THEN 'hotel'
    WHEN 'shop' THEN 'shop'
    WHEN '商城购物' THEN 'shop'
    ELSE LOWER(COALESCE(_t,''))
  END
$$;

-- 2. service_type → 接单角色
CREATE OR REPLACE FUNCTION public.service_type_role(_t text)
RETURNS public.app_role LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE public.canonical_service_type(_t)
    WHEN 'groom' THEN 'groomer'::public.app_role
    WHEN 'walk' THEN 'sitter'::public.app_role
    WHEN 'feed' THEN 'sitter'::public.app_role
    WHEN 'pickup' THEN 'driver'::public.app_role
    WHEN 'delivery' THEN 'driver'::public.app_role
    ELSE NULL
  END
$$;

-- 3. BEFORE INSERT/UPDATE 归一 service_type
CREATE OR REPLACE FUNCTION public.orders_normalize_service_type()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.service_type IS NOT NULL THEN
    NEW.service_type := public.canonical_service_type(NEW.service_type);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orders_normalize_service_type ON public.orders;
CREATE TRIGGER trg_orders_normalize_service_type
BEFORE INSERT OR UPDATE OF service_type ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_normalize_service_type();

-- 4. 支付成功 -> pending_accept (服务类且未指派)
CREATE OR REPLACE FUNCTION public.orders_after_pay_to_hall()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payment_status = 'paid'
     AND COALESCE(OLD.payment_status,'') IS DISTINCT FROM 'paid'
     AND COALESCE(NEW.order_type,'service') = 'service'
     AND NEW.provider_id IS NULL
     AND NEW.driver_id IS NULL
     AND NEW.hotel_id IS NULL
     AND public.service_type_role(NEW.service_type) IS NOT NULL
     AND NEW.order_status IN ('created','confirmed','paid') THEN
    NEW.order_status := 'pending_accept';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orders_after_pay_to_hall ON public.orders;
CREATE TRIGGER trg_orders_after_pay_to_hall
BEFORE UPDATE OF payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_after_pay_to_hall();

-- 5. AFTER UPDATE -> 广播通知给对应角色
CREATE OR REPLACE FUNCTION public.orders_notify_hall_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _role public.app_role;
  _title text;
  _content text;
BEGIN
  IF NEW.order_status = 'pending_accept'
     AND COALESCE(OLD.order_status,'') IS DISTINCT FROM 'pending_accept'
     AND NEW.provider_id IS NULL THEN
    _role := public.service_type_role(NEW.service_type);
    IF _role IS NULL THEN RETURN NEW; END IF;
    _title := '新订单待接单';
    _content := format('一笔 %s 订单 #%s 待接，金额 ¥%s',
      COALESCE(NEW.service_type,'服务'), COALESCE(NEW.order_no, LEFT(NEW.id::text,8)),
      COALESCE(NEW.total_amount,0));
    INSERT INTO public.notifications (user_id, title, content, type, related_id)
    SELECT ur.user_id, _title, _content, 'order_hall', NEW.id::text
    FROM public.user_roles ur
    WHERE ur.role = _role
    LIMIT 200;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orders_notify_hall_role ON public.orders;
CREATE TRIGGER trg_orders_notify_hall_role
AFTER UPDATE OF order_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_notify_hall_role();

-- 6. Backfill 历史数据：归一 service_type
UPDATE public.orders
SET service_type = public.canonical_service_type(service_type)
WHERE service_type IS NOT NULL
  AND service_type <> public.canonical_service_type(service_type);

-- 7. Backfill：已支付但仍 created/confirmed/paid 且未指派的服务单 → pending_accept
UPDATE public.orders
SET order_status = 'pending_accept'
WHERE payment_status = 'paid'
  AND COALESCE(order_type,'service') = 'service'
  AND provider_id IS NULL AND driver_id IS NULL AND hotel_id IS NULL
  AND public.service_type_role(service_type) IS NOT NULL
  AND order_status IN ('created','confirmed','paid');