-- 1. 平台五重安全保障（全局展示，无需 user_id）
CREATE TABLE public.safety_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,           -- e.g. real_name / training / insurance / monitor / background
  title TEXT NOT NULL,                 -- 中文标题
  title_en TEXT,                       -- 英文标题（i18n）
  description TEXT NOT NULL,
  description_en TEXT,
  icon TEXT NOT NULL DEFAULT 'shield', -- lucide icon name
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.safety_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Safety badges viewable by everyone"
ON public.safety_badges FOR SELECT TO public
USING (is_active = true);

CREATE TRIGGER update_safety_badges_updated_at
BEFORE UPDATE ON public.safety_badges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 种子数据：五重安全保障
INSERT INTO public.safety_badges (code, title, title_en, description, description_en, icon, sort_order) VALUES
('real_name',  '100% 实名认证',     '100% Real-Name Verified', '所有宠托师均通过身份证+人脸核验',          'All sitters verified with ID + face check', 'badge-check', 1),
('training',   '专业培训考核',       'Professional Training',   '上岗前完成宠物行为学与急救培训',            'Mandatory pet behavior & first-aid training', 'graduation-cap', 2),
('insurance',  '全线保险覆盖',       'Full Insurance Coverage', '入户与运输全程意外险与第三者责任险',        'Accident & liability insurance for every visit', 'shield-check', 3),
('monitor',    '全程监控录制',       'Service Recording',       '关键节点录像存证，支持随时调阅',            'Key moments recorded, retrievable on demand', 'video', 4),
('background', '背景调查无犯罪',     'Background Screened',     '所有宠托师完成无犯罪记录核查',              'All sitters pass criminal background screening', 'user-check', 5);

-- 2. 宠托师统计（平台等级 / 服务次数 / 评分 / 保险编号）
CREATE TABLE public.technician_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  technician_code TEXT NOT NULL UNIQUE,    -- 与前端 services.ts 中技师 id 关联
  display_name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'silver',    -- bronze / silver / gold / platinum / diamond
  total_services INTEGER NOT NULL DEFAULT 0,
  avg_rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  review_count INTEGER NOT NULL DEFAULT 0,
  years_of_experience INTEGER NOT NULL DEFAULT 0,
  insurance_no TEXT,                       -- 公开展示的保险单号
  certifications TEXT[] NOT NULL DEFAULT '{}',
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.technician_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Technician stats viewable by everyone"
ON public.technician_stats FOR SELECT TO public
USING (true);

CREATE TRIGGER update_technician_stats_updated_at
BEFORE UPDATE ON public.technician_stats
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 种子数据：与前端 TECHNICIANS 配对（4 位示范技师）
INSERT INTO public.technician_stats
  (technician_code, display_name, level, total_services, avg_rating, review_count, years_of_experience, insurance_no, certifications, bio) VALUES
('tech_001', '李小美', 'diamond',  1280, 4.95, 412, 5, 'PICC-2026-PET-00012', ARRAY['宠物美容师高级','宠物急救认证'], '专注犬猫美容5年，温柔耐心，擅长长毛犬护理。'),
('tech_002', '王师傅', 'platinum', 980,  4.92, 305, 4, 'PICC-2026-PET-00033', ARRAY['训犬师中级','行为矫正师'],     '4年训犬经验，擅长基础服从与社会化训练。'),
('tech_003', '张医生', 'diamond',  1560, 4.98, 520, 8, 'PICC-2026-PET-00007', ARRAY['执业兽医师','宠物心肺复苏'], '执业兽医，提供上门体检与日常健康咨询。'),
('tech_004', '陈姐姐', 'gold',     620,  4.88, 198, 3, 'PICC-2026-PET-00088', ARRAY['宠物寄养师','宠物营养师'],     '提供贴心上门寄养与遛狗服务，对老年宠物经验丰富。');

-- 3. 紧急求助记录（用于 SOS 上报异常）
CREATE TABLE public.emergency_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  order_id UUID,
  report_type TEXT NOT NULL,            -- call_support / online_vet / report_incident
  description TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'open',  -- open / handling / resolved
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.emergency_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create own emergency reports"
ON public.emergency_reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own emergency reports"
ON public.emergency_reports FOR SELECT TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update emergency reports"
ON public.emergency_reports FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_emergency_reports_updated_at
BEFORE UPDATE ON public.emergency_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_emergency_reports_user ON public.emergency_reports(user_id, created_at DESC);