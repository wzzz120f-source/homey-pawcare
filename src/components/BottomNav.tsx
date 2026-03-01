import { Link, useLocation } from "react-router-dom";
import { Home, Calendar, MessageSquare, User } from "lucide-react";

const BottomNav = () => {
  const location = useLocation();
  const tabs = [
    { path: "/", icon: Home, label: "首页" },
    { path: "/booking", icon: Calendar, label: "预约" },
    { path: "/community", icon: MessageSquare, label: "社区" },
    { path: "/profile", icon: User, label: "我的" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
              <span className="text-xs font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
