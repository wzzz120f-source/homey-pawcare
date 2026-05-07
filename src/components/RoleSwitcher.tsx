import { useUserRoles, type ActiveRole } from "@/hooks/useUserRoles";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, User, HardHat, Store, ShieldCheck, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ROLE_META: Record<ActiveRole, { label: string; icon: typeof User; tone: string; home: string }> = {
  user: { label: "铲屎官", icon: User, tone: "暖橙", home: "/" },
  worker: { label: "守护者", icon: HardHat, tone: "森林绿", home: "/worker" },
  merchant: { label: "商家", icon: Store, tone: "深紫", home: "/merchant" },
  admin: { label: "审核员", icon: ShieldCheck, tone: "深蓝", home: "/admin/review" },
};

interface Props {
  /** 切换后是否跳转到对应角色首页，默认 true */
  navigateOnSwitch?: boolean;
  className?: string;
}

const RoleSwitcher = ({ navigateOnSwitch = true, className }: Props) => {
  const { activeRole, availableRoles, setActiveRole, loading } = useUserRoles();
  const navigate = useNavigate();
  const Cur = ROLE_META[activeRole].icon;

  if (loading) return null;
  // 只有一种角色时不显示切换器
  if (availableRoles.length <= 1) return null;

  const handleSwitch = (r: ActiveRole) => {
    setActiveRole(r === "user" ? null : r); // user 视为默认
    if (navigateOnSwitch) navigate(ROLE_META[r].home);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold min-h-[36px] hover:bg-primary/15 transition-colors " +
          (className ?? "")
        }
        aria-label="切换角色视图"
      >
        <Cur className="w-3.5 h-3.5" />
        <span>{ROLE_META[activeRole].label}</span>
        <ChevronDown className="w-3 h-3 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs">切换至</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableRoles.map((r) => {
          const M = ROLE_META[r];
          const I = M.icon;
          const active = r === activeRole;
          return (
            <DropdownMenuItem
              key={r}
              onClick={() => handleSwitch(r)}
              className="cursor-pointer gap-2"
            >
              <I className="w-4 h-4" />
              <div className="flex-1">
                <div className="text-sm font-medium">{M.label}</div>
                <div className="text-[10px] text-muted-foreground">{M.tone}主题</div>
              </div>
              {active && <Check className="w-4 h-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RoleSwitcher;
