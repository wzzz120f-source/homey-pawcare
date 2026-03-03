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

export const TECHNICIANS: readonly Technician[] = [
  { id: "tech-1", name: "李小萌", avatar: serviceBath, specialty: "猫咪美容 · 8年经验", rating: 4.9, reviews: 326, distance: "1.2km" },
  { id: "tech-2", name: "王大鹏", avatar: serviceGrooming, specialty: "大型犬护理 · 6年经验", rating: 4.8, reviews: 218, distance: "2.5km" },
  { id: "tech-3", name: "张美丽", avatar: serviceHealth, specialty: "宠物健康师 · 10年经验", rating: 5.0, reviews: 502, distance: "0.8km" },
] as const;
