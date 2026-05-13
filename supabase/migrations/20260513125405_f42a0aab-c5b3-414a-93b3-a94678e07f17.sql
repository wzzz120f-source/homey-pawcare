
-- sms_codes: 短信验证码（仅 service_role 可读写）
CREATE TABLE IF NOT EXISTS public.sms_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  purpose text NOT NULL DEFAULT 'login',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sms_codes_phone_created ON public.sms_codes(phone, created_at DESC);
ALTER TABLE public.sms_codes ENABLE ROW LEVEL SECURITY;
-- 无任何 policy = 普通用户完全不可访问；service_role 自动绕过 RLS

-- phone_accounts: 手机号 -> auth.users 映射
CREATE TABLE IF NOT EXISTS public.phone_accounts (
  phone text PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.phone_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phone_accounts_self_read" ON public.phone_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- profiles 增加 phone 字段（如不存在）
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone) WHERE phone IS NOT NULL;
