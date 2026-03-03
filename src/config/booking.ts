import type { PetType, ServiceType, NearbyStore, TimeSlot } from "@/types";

export const PET_TYPES: readonly PetType[] = [
  { id: "dog-small", emoji: "🐶", label: "小型犬" },
  { id: "dog-medium", emoji: "🐕", label: "中型犬" },
  { id: "dog-large", emoji: "🦮", label: "大型犬" },
  { id: "cat", emoji: "🐱", label: "猫咪" },
  { id: "rabbit", emoji: "🐰", label: "兔子" },
  { id: "other", emoji: "🐾", label: "其他" },
] as const;

export const SERVICE_TYPES: readonly ServiceType[] = [
  { id: "bath", label: "洗澡 SPA", price: "¥89起", icon: "🛁" },
  { id: "grooming", label: "美容造型", price: "¥128起", icon: "✂️" },
  { id: "health", label: "健康检查", price: "¥168起", icon: "🩺" },
  { id: "walking", label: "遛狗陪伴", price: "¥58起", icon: "🦮" },
] as const;

export const TIME_SLOTS: readonly TimeSlot[] = [
  "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
] as const;

export const NEARBY_STORES: readonly NearbyStore[] = [
  { id: "store-1", name: "萌宠乐园·浦东店", address: "浦东新区张杨路500号", distance: "0.8km", rating: 4.9 },
  { id: "store-2", name: "爱宠之家·陆家嘴店", address: "浦东新区东方路300号", distance: "1.5km", rating: 4.8 },
  { id: "store-3", name: "宠物天堂·世纪公园店", address: "浦东新区锦绣路200号", distance: "2.1km", rating: 4.7 },
] as const;
