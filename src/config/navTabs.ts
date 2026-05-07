import { Home, ShoppingBag, MessageSquare, User, Headphones, ClipboardList, GraduationCap, BarChart3, Package, Store, ShieldCheck } from "lucide-react";
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
  worker: [
    { path: "/worker", icon: ClipboardList, label: "工作台" },
    { path: "/orders", icon: Package, label: "订单" },
    { path: "/shop", icon: ShoppingBag, label: "商城" },
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
