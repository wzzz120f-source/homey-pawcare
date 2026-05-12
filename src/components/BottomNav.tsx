import { forwardRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useUserRoles } from "@/hooks/useUserRoles";
import { NAV_TABS } from "@/config/navTabs";
import DevLogoTrigger from "@/components/dev/DevLogoTrigger";

const BottomNav = forwardRef<HTMLElement>((_props, ref) => {
  const { pathname } = useLocation();
  const { activeRole } = useUserRoles();
  const tabs = NAV_TABS[activeRole] ?? NAV_TABS.user;

  return (
    <nav
      ref={ref}
      data-bottom-nav
      data-role={activeRole}
      className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pb-[env(safe-area-inset-bottom)]"
      aria-label="主导航"
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = pathname === tab.path.split("?")[0];
          return (
            <Link
              key={tab.path}
              to={tab.path}
              aria-current={active ? "page" : undefined}
              aria-label={tab.label}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors min-w-[44px] min-h-[44px] justify-center ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
              <span className="text-xs font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
      <DevLogoTrigger>
        <div className="text-center py-2 border-t border-border/30 bg-card cursor-default select-none">
          <p className="text-[10px] text-muted-foreground leading-tight">©2026 萌宠到家 版权所有</p>
          <p className="text-[9px] text-muted-foreground/60 leading-tight mt-0.5">禁止抄袭、反编译、盗用接口及源码</p>
        </div>
      </DevLogoTrigger>
    </nav>
  );
});
BottomNav.displayName = "BottomNav";

export default BottomNav;
