
-- 1) 管理员近期再认证记录（密码二次确认 5 分钟有效窗口）
CREATE TABLE IF NOT EXISTS public.recent_admin_auth (
  admin_id UUID NOT NULL PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL DEFAULT 'sensitive',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recent_admin_auth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "self_read_recent_admin_auth"
  ON public.recent_admin_auth FOR SELECT TO authenticated
  USING (auth.uid() = admin_id);

-- 仅 service role 可写（edge function 使用 service key）
-- 2) 防重复申请：driver_applications 是共享表，按 (user_id, role_requested) 限制 pending/approved 唯一
CREATE UNIQUE INDEX IF NOT EXISTS uniq_driver_applications_active
  ON public.driver_applications (user_id, role_requested)
  WHERE status IN ('pending', 'approved');

-- 3) 防止积分刷动作：每用户每动作的最近一次时间
CREATE TABLE IF NOT EXISTS public.love_points_rate (
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  last_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, action_type)
);
ALTER TABLE public.love_points_rate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self_read_love_points_rate"
  ON public.love_points_rate FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 4) 安全 RPC：校验最近管理员认证是否仍然有效
CREATE OR REPLACE FUNCTION public.is_admin_recently_authed(_admin_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.recent_admin_auth
    WHERE admin_id = _admin_id AND expires_at > now()
  );
$$;
