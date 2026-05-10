import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, LayoutDashboard, ClipboardList, Percent, BarChart3, Banknote, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin", label: "总览", icon: LayoutDashboard, exact: true },
  { to: "/admin/applications", label: "注册审核", icon: ClipboardList },
  { to: "/admin/commission", label: "抽成", icon: Percent },
  { to: "/admin/revenue", label: "收益", icon: BarChart3 },
  { to: "/admin/withdrawals", label: "提现", icon: Banknote },
];

const AdminLayout = ({ children, title }: { children: ReactNode; title: string }) => {
  const loc = useLocation();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate(-1)} aria-label="返回" className="p-2 -ml-2"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-lg font-semibold flex-1 truncate">开发者后台 · {title}</h1>
        </div>
        <nav className="max-w-3xl mx-auto px-2 pb-2 flex gap-1 overflow-x-auto">
          {NAV.map((n) => {
            const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to} className={cn("flex items-center gap-1 px-3 py-1.5 rounded-full text-sm whitespace-nowrap", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <Icon className="w-4 h-4" />{n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-4">{children}</main>
    </div>
  );
};

export default AdminLayout;
