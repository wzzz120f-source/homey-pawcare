import { Link, useLocation } from "react-router-dom";
import { Home, ShoppingBag, MessageSquare, User, Headphones } from "lucide-react";
import type { NavTab } from "@/types";

const TABS: readonly NavTab[] = [
  { path: "/", icon: Home, label: "首页" },
  { path: "/shop", icon: ShoppingBag, label: "商城" },
  { path: "/community", icon: MessageSquare, label: "社区" },
  { path: "/customer-service", icon: Headphones, label: "客服" },
  { path: "/profile", icon: User, label: "我的" },
];

const BottomNav = () => {
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border"
      aria-label="主导航"
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {TABS.map((tab) => {
          const active = pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              aria-current={active ? "page" : undefined}
              aria-label={tab.label}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors min-w-[44px] min-h-[44px] justify-center ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
              <span className="text-xs font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
