-- 1) technician_reviews: 最近评价
CREATE TABLE public.technician_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  technician_code TEXT NOT NULL,
  reviewer_name TEXT NOT NULL,
  reviewer_avatar TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  service_type TEXT NOT NULL,
  content TEXT NOT NULL,
  technician_level TEXT NOT NULL DEFAULT 'silver',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_tech_reviews_code_created ON public.technician_reviews (technician_code, created_at DESC);
CREATE INDEX idx_tech_reviews_level ON public.technician_reviews (technician_level);

ALTER TABLE public.technician_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Technician reviews viewable by everyone"
  ON public.technician_reviews FOR SELECT
  USING (true);

-- 2) emergency_reports: 增加工单号 + 预计响应时间 + 当前状态历史
ALTER TABLE public.emergency_reports
  ADD COLUMN IF NOT EXISTS ticket_no TEXT,
  ADD COLUMN IF NOT EXISTS eta_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;

-- 自动生成 ticket_no
CREATE OR REPLACE FUNCTION public.set_emergency_ticket_no()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ticket_no IS NULL THEN
    NEW.ticket_no := 'SOS' || to_char(now(), 'YYYYMMDD') || substr(replace(NEW.id::text, '-', ''), 1, 6);
  END IF;
  IF NEW.eta_minutes IS NULL THEN
    NEW.eta_minutes := CASE NEW.report_type
      WHEN 'call_support' THEN 2
      WHEN 'vet_hotline' THEN 5
      WHEN 'incident_report' THEN 15
      ELSE 10
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_emergency_ticket_no ON public.emergency_reports;
CREATE TRIGGER trg_set_emergency_ticket_no
  BEFORE INSERT ON public.emergency_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_emergency_ticket_no();

-- 3) 种子评价数据 (tech_001 ~ tech_005)
INSERT INTO public.technician_reviews (technician_code, reviewer_name, rating, service_type, content, technician_level, created_at) VALUES
  ('tech_001', '张***', 5, 'pet_walking', '非常细心，狗狗回来很开心，照片视频都有发，五星好评！', 'gold', now() - interval '2 days'),
  ('tech_001', '李***', 5, 'pet_sitting', '准时上门，给猫咪喂食铲屎都很专业，下次还约。', 'gold', now() - interval '5 days'),
  ('tech_001', '王***', 4, 'pet_walking', '整体服务不错，遛狗时间充足，下次可以更主动沟通。', 'gold', now() - interval '8 days'),
  ('tech_001', '陈***', 5, 'pet_grooming', '洗护很温柔，狗狗一点都不害怕，毛发处理得很干净。', 'gold', now() - interval '12 days'),
  ('tech_001', '刘***', 5, 'pet_sitting', '出差三天每天都准时，全程视频，非常放心。', 'gold', now() - interval '18 days'),
  ('tech_001', '黄***', 4, 'pet_walking', '服务到位，希望以后能多陪玩一会。', 'gold', now() - interval '25 days'),
  ('tech_001', '赵***', 5, 'pet_sitting', '把家里照顾得井井有条，连花都帮忙浇了。', 'gold', now() - interval '32 days'),
  ('tech_002', '孙***', 5, 'pet_walking', '宠托师很有耐心，第一次约就很满意。', 'silver', now() - interval '3 days'),
  ('tech_002', '周***', 4, 'pet_grooming', '剪毛技术不错，价格也合理。', 'silver', now() - interval '10 days'),
  ('tech_002', '吴***', 5, 'pet_sitting', '猫咪比较怕生，宠托师慢慢接触很专业。', 'silver', now() - interval '15 days'),
  ('tech_003', '郑***', 5, 'pet_walking', '体力很好，能带我家大型犬跑步。', 'platinum', now() - interval '1 day'),
  ('tech_003', '钱***', 5, 'pet_sitting', '钻石级宠托师名不虚传，全程报告非常详细。', 'platinum', now() - interval '6 days'),
  ('tech_003', '冯***', 5, 'pet_grooming', '美容造型超级满意，朋友看了都问。', 'platinum', now() - interval '14 days'),
  ('tech_003', '蒋***', 4, 'pet_walking', '挺好的，下次还会预约。', 'platinum', now() - interval '20 days'),
  ('tech_004', '韩***', 5, 'pet_sitting', '专业有爱，给狗狗喂药也没问题。', 'silver', now() - interval '4 days'),
  ('tech_004', '杨***', 4, 'pet_walking', '准时友好，服务符合预期。', 'silver', now() - interval '11 days'),
  ('tech_005', '朱***', 5, 'pet_sitting', '兽医背景的宠托师就是放心，老猫照顾得很好。', 'gold', now() - interval '7 days'),
  ('tech_005', '秦***', 5, 'pet_grooming', '处理皮肤问题很专业，狗狗不再抓痒了。', 'gold', now() - interval '16 days'),
  ('tech_005', '尤***', 5, 'pet_walking', '价格实惠，服务一流。', 'gold', now() - interval '22 days');