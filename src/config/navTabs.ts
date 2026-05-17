import {
  Home,
  ShoppingBag,
  MessageSquare,
  User,
  Headphones,
  ClipboardList,
  GraduationCap,
  BarChart3,
  Package,
  Store,
  ShieldCheck,
  Scissors,
  Heart,
  Car,
  Map,
  CalendarClock,
  Hotel,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ActiveRole } from "@/hooks/useUserRoles";

export interface NavTabItem {
  path: string;
  icon: LucideIcon;
  label: string;
}

export const NAV_TABS: Record<ActiveRole, NavTabItem[]> = {
  user: [
    { path: "/", icon: Home, label: "首页" },
    { path: "/shop", icon: ShoppingBag, label: "商城" },
    { path: "/community", icon: MessageSquare, label: "社区" },
    { path: "/customer-service", icon: Headphones, label: "客服" },
    { path: "/profile", icon: User, label: "我的" },
  ],
  sitter: [
    { path: "/worker", icon: Heart, label: "寄养" },
    { path: "/orders", icon: Package, label: "订单" },
    { path: "/worker?tab=schedule", icon: CalendarClock, label: "排班" },
    { path: "/worker?tab=training", icon: GraduationCap, label: "培训" },
    { path: "/profile", icon: User, label: "我的" },
  ],
  groomer: [
    { path: "/worker", icon: Scissors, label: "美容" },
    { path: "/orders", icon: Package, label: "订单" },
    { path: "/worker?tab=services", icon: ClipboardList, label: "服务" },
    { path: "/worker?tab=training", icon: GraduationCap, label: "培训" },
    { path: "/profile", icon: User, label: "我的" },
  ],
  driver: [
    { path: "/worker", icon: Car, label: "任务" },
    { path: "/worker?tab=route", icon: Map, label: "路线" },
    { path: "/orders", icon: Package, label: "订单" },
    { path: "/worker?tab=training", icon: GraduationCap, label: "培训" },
    { path: "/profile", icon: User, label: "我的" },
  ],
  merchant: [
    { path: "/merchant", icon: BarChart3, label: "看板" },
    { path: "/merchant/admin", icon: Store, label: "管理" },
    { path: "/shop", icon: ShoppingBag, label: "商城" },
    { path: "/orders", icon: Package, label: "订单" },
    { path: "/profile", icon: User, label: "我的" },
  ],
  admin: [
    { path: "/", icon: Home, label: "首页" },
    { path: "/admin/review", icon: ShieldCheck, label: "审核" },
    { path: "/shop", icon: ShoppingBag, label: "商城" },
    { path: "/community", icon: MessageSquare, label: "社区" },
    { path: "/profile", icon: User, label: "我的" },
  ],
};
