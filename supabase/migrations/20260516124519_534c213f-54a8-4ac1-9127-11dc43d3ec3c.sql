
-- 1) Notify eligible providers when an order enters pending_accept
CREATE OR REPLACE FUNCTION public.trg_notify_providers_pending_accept()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role;
  _svc text := lower(coalesce(NEW.service_type,''));
BEGIN
  IF NEW.order_status = 'pending_accept'
     AND coalesce(OLD.order_status,'') <> 'pending_accept'
     AND NEW.provider_id IS NULL THEN
    _role := CASE
      WHEN _svc LIKE '%groom%' OR _svc LIKE '%美容%' OR _svc LIKE '%洗澡%' THEN 'groomer'::public.app_role
      WHEN _svc LIKE '%pickup%' OR _svc LIKE '%delivery%' OR _svc LIKE '%接送%' OR _svc LIKE '%打车%' THEN 'driver'::public.app_role
      WHEN _svc LIKE '%sit%' OR _svc LIKE '%上门%' OR _svc LIKE '%陪伴%' OR _svc LIKE '%遛%' THEN 'sitter'::public.app_role
      ELSE NULL
    END;
    IF _role IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, type, title, content, related_id)
      SELECT ur.user_id, 'order', '新任务可抢',
             '附近有一单'||coalesce(NEW.service_type,'服务')||'，去工作台抢单吧',
             NEW.id::text
        FROM public.user_roles ur
       WHERE ur.role = _role
       LIMIT 50;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notify_providers_pending_accept ON public.orders;
CREATE TRIGGER notify_providers_pending_accept
  AFTER INSERT OR UPDATE OF order_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_providers_pending_accept();

-- 2) Notify appeal submitter when reply/status changes
CREATE OR REPLACE FUNCTION public.trg_notify_appeal_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (coalesce(NEW.reply,'') <> coalesce(OLD.reply,''))
     OR (NEW.status IS DISTINCT FROM OLD.status) THEN
    INSERT INTO public.notifications(user_id, type, title, content, related_id)
    VALUES (NEW.user_id, 'system', '申诉有新进展',
            CASE WHEN coalesce(NEW.reply,'') <> coalesce(OLD.reply,'')
                 THEN '客服回复：'||left(NEW.reply, 80)
                 ELSE '申诉状态已更新为「'||NEW.status||'」' END,
            NEW.id::text);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notify_appeal_update ON public.merchant_appeals;
CREATE TRIGGER notify_appeal_update
  AFTER UPDATE ON public.merchant_appeals
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_appeal_update();
