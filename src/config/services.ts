import type { Service, Technician } from "@/types";

import serviceBath from "@/assets/service-bath.jpg";
import serviceGrooming from "@/assets/service-grooming.jpg";
import serviceHealth from "@/assets/service-health.jpg";
import serviceWalking from "@/assets/service-walking.jpg";

export const SERVICES: readonly Service[] = [
  { id: "bath", image: serviceBath, title: "宠物洗澡 SPA", price: "¥89起", rating: 4.9 },
  { id: "grooming", image: serviceGrooming, title: "精致美容造型", price: "¥128起", rating: 4.8 },
  { id: "health", image: serviceHealth, title: "上门健康检查", price: "¥168起", rating: 4.9 },
  { id: "walking", image: serviceWalking, title: "专业遛狗陪伴", price: "¥58起", rating: 4.7 },
] as const;

/**
 * 把 UI/页面层的 service_type 标签归一到后端枚举：
 *  groom | walk | feed | pickup | delivery | hotel | shop
 * 抢单大厅/工作台/通知触发器均以归一后的值匹配。
 */
export function canonicalServiceType(t?: string | null): string | null {
  if (!t) return null;
  const key = String(t).toLowerCase();
  const map: Record<string, string> = {
    bath: "groom", grooming: "groom", health: "groom", groom: "groom",
    walking: "walk", walk: "walk",
    home: "feed", feed: "feed",
    pickup: "pickup", delivery: "delivery",
    hotel: "hotel", shop: "shop",
    商城购物: "shop",
  };
  return map[key] ?? key;
}

export const TECHNICIANS: readonly Technician[] = [
  { id: "tech-1", name: "李小萌", avatar: serviceBath, specialty: "猫咪美容 · 8年经验", rating: 4.9, reviews: 326, distance: "1.2km" },
  { id: "tech-2", name: "王大鹏", avatar: serviceGrooming, specialty: "大型犬护理 · 6年经验", rating: 4.8, reviews: 218, distance: "2.5km" },
  { id: "tech-3", name: "张美丽", avatar: serviceHealth, specialty: "宠物健康师 · 10年经验", rating: 5.0, reviews: 502, distance: "0.8km" },
] as const;
