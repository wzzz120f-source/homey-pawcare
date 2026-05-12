
-- 1. profiles 增加超管/封禁字段
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_reason text,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz;

-- 2. 超管判定函数（SECURITY DEFINER 防递归）
CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_super_admin FROM public.profiles WHERE user_id = _uid), false);
$$;

-- 3. feature_flags 表
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_flags_read_all ON public.feature_flags;
CREATE POLICY feature_flags_read_all ON public.feature_flags
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS feature_flags_super_write ON public.feature_flags;
CREATE POLICY feature_flags_super_write ON public.feature_flags
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 预置开关
INSERT INTO public.feature_flags(key, enabled, description) VALUES
  ('maintenance_mode', false, '全站维护模式（超管不受影响）'),
  ('payment_enabled', true, '支付通道总开关'),
  ('community_post_enabled', true, '社区发帖开关'),
  ('ai_chat_enabled', true, 'AI 客服开关'),
  ('flash_sale_enabled', true, '限时秒杀开关')
ON CONFLICT (key) DO NOTHING;

-- 4. 超管 RPC：设置开关
CREATE OR REPLACE FUNCTION public.dev_set_flag(_key text, _enabled boolean, _payload jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF NOT public.is_super_admin(_uid) THEN RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;
  INSERT INTO public.feature_flags(key, enabled, payload, updated_at, updated_by)
    VALUES (_key, _enabled, COALESCE(_payload,'{}'::jsonb), now(), _uid)
    ON CONFLICT (key) DO UPDATE
      SET enabled = EXCLUDED.enabled,
          payload = COALESCE(EXCLUDED.payload, public.feature_flags.payload),
          updated_at = now(), updated_by = _uid;
  PERFORM public.log_admin_action('flag_updated','feature_flag',_key, jsonb_build_object('enabled',_enabled));
  RETURN jsonb_build_object('success',true);
END $$;

-- 5. 超管 RPC：用户列表（聚合）
CREATE OR REPLACE FUNCTION public.dev_list_users(_search text DEFAULT NULL, _limit int DEFAULT 50, _offset int DEFAULT 0)
RETURNS TABLE(
  user_id uuid, username text, avatar_url text, love_points int,
  is_banned boolean, is_super_admin boolean, banned_reason text,
  roles text[], created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.username, p.avatar_url, COALESCE(p.love_points,0),
    p.is_banned, p.is_super_admin, p.banned_reason,
    COALESCE((SELECT array_agg(role::text) FROM public.user_roles ur WHERE ur.user_id = p.user_id),'{}'),
    p.created_at
  FROM public.profiles p
  WHERE public.is_super_admin(auth.uid())
    AND (_search IS NULL OR _search = ''
         OR p.username ILIKE '%'||_search||'%'
         OR p.user_id::text = _search)
  ORDER BY p.created_at DESC
  LIMIT GREATEST(LEAST(_limit,200),1) OFFSET GREATEST(_offset,0);
$$;

-- 6. 超管 RPC：封禁
CREATE OR REPLACE FUNCTION public.dev_set_ban(_user_id uuid, _ban boolean, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF NOT public.is_super_admin(_uid) THEN RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;
  UPDATE public.profiles
    SET is_banned = _ban,
        banned_reason = CASE WHEN _ban THEN _reason ELSE NULL END,
        banned_at = CASE WHEN _ban THEN now() ELSE NULL END,
        updated_at = now()
    WHERE user_id = _user_id;
  PERFORM public.log_admin_action(CASE WHEN _ban THEN 'user_banned' ELSE 'user_unbanned' END,'user',_user_id::text, jsonb_build_object('reason',_reason));
  RETURN jsonb_build_object('success',true);
END $$;

-- 7. 超管 RPC：改资料
CREATE OR REPLACE FUNCTION public.dev_update_profile(_user_id uuid, _username text DEFAULT NULL, _avatar_url text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF NOT public.is_super_admin(_uid) THEN RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;
  UPDATE public.profiles
    SET username = COALESCE(_username, username),
        avatar_url = COALESCE(_avatar_url, avatar_url),
        updated_at = now()
    WHERE user_id = _user_id;
  PERFORM public.log_admin_action('user_profile_updated','user',_user_id::text, jsonb_build_object('username',_username));
  RETURN jsonb_build_object('success',true);
END $$;

-- 8. 超管 RPC：授/撤角色
CREATE OR REPLACE FUNCTION public.dev_set_role(_user_id uuid, _role app_role, _grant boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF NOT public.is_super_admin(_uid) THEN RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;
  IF _grant THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, _role) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  END IF;
  PERFORM public.log_admin_action(CASE WHEN _grant THEN 'role_granted' ELSE 'role_revoked' END,'user',_user_id::text, jsonb_build_object('role',_role));
  RETURN jsonb_build_object('success',true);
END $$;

-- 9. 超管 RPC：切换超管标记（仅当前超管可调）
CREATE OR REPLACE FUNCTION public.dev_set_super_admin(_user_id uuid, _value boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF NOT public.is_super_admin(_uid) THEN RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;
  UPDATE public.profiles SET is_super_admin = _value, updated_at = now() WHERE user_id = _user_id;
  PERFORM public.log_admin_action('super_admin_toggled','user',_user_id::text, jsonb_build_object('value',_value));
  RETURN jsonb_build_object('success',true);
END $$;

-- 10. 健康概览 RPC
CREATE OR REPLACE FUNCTION public.dev_health_overview()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;
  SELECT jsonb_build_object(
    'success', true,
    'profiles_total', (SELECT count(*) FROM public.profiles),
    'banned_total', (SELECT count(*) FROM public.profiles WHERE is_banned),
    'orders_24h', (SELECT count(*) FROM public.orders WHERE created_at > now() - interval '24 hours'),
    'orders_failed_24h', (SELECT count(*) FROM public.orders WHERE created_at > now() - interval '24 hours' AND order_status = 'cancelled'),
    'payments_pending', (SELECT count(*) FROM public.payments WHERE status = 'pending'),
    'payments_paid_24h', (SELECT count(*) FROM public.payments WHERE status = 'paid' AND updated_at > now() - interval '24 hours'),
    'withdrawals_pending', (SELECT count(*) FROM public.withdrawal_requests WHERE status IN ('pending','flagged')),
    'kyc_pending', (SELECT count(*) FROM public.rescue_kyc WHERE status = 'pending'),
    'rescue_pending', (SELECT count(*) FROM public.rescue_stories WHERE verify_status = 'pending'),
    'violations_24h', (SELECT count(*) FROM public.content_violations WHERE created_at > now() - interval '24 hours'),
    'admin_actions_24h', (SELECT count(*) FROM public.admin_audit_logs WHERE created_at > now() - interval '24 hours')
  ) INTO _r;
  RETURN _r;
END $$;
