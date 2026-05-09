-- 演示数据 seed（幂等）
-- 用法：在 Supabase SQL Editor 中执行，或通过 psql 注入。

-- 1. 商品分类
INSERT INTO public.product_categories (id, name, sort_order) VALUES
  ('c1111111-1111-1111-1111-111111111111', '猫用品', 1),
  ('c2222222-2222-2222-2222-222222222222', '狗用品', 2),
  ('c3333333-3333-3333-3333-333333333333', '玩具',   3),
  ('c4444444-4444-4444-4444-444444444444', '服饰',   4),
  ('c5555555-5555-5555-5555-555555555555', '保健',   5)
ON CONFLICT (id) DO NOTHING;

-- 2. 首页横幅
INSERT INTO public.banners (id, title, image_url, link_url, sort_order, is_active) VALUES
  ('b1111111-1111-1111-1111-111111111111', '新人首单立减 ¥30', 'https://images.unsplash.com/photo-1583511655826-05700d52f4d9?w=1200', '/shop', 1, true),
  ('b2222222-2222-2222-2222-222222222222', '上门美容 9 折', 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=1200', '/booking', 2, true)
ON CONFLICT (id) DO NOTHING;

-- 3. 宠物酒店
INSERT INTO public.pet_hotels (id, name, address, latitude, longitude, price_min, price_max, rating, image_url, is_active) VALUES
  ('h1111111-1111-1111-1111-111111111111', '阳光宠物酒店',  '上海市浦东新区张杨路 500 号', 31.231, 121.480, 88,  288, 4.8, 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?w=800', true),
  ('h2222222-2222-2222-2222-222222222222', '萌宠之家',      '上海市徐汇区漕溪北路 100 号', 31.190, 121.435, 128, 388, 4.7, 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=800', true)
ON CONFLICT (id) DO NOTHING;

-- 提示：products / merchants 等结构因业务字段较多，请通过商家中心创建演示商品；
-- 或自行扩展本文件，参考 supabase/migrations 中的字段定义。
