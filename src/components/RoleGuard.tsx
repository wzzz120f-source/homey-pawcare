import { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles, type AppRole } from "@/hooks/useUserRoles";

interface Props {
  allow: AppRole[];
  children: React.ReactNode;
  /** 未登录时跳转，默认 /auth */
  loginPath?: string;
}

const ROLE_CN: Record<AppRole, string> = {
  admin: "审核员",
  merchant: "商家",
  user: "铲屎官",
  sitter: "宠托师",
  groomer: "护理师",
  driver: "司机",
};

/**
 * 路由级角色守卫：未登录跳 /auth，越权跳 /roles 并高亮所需角色。
 */
const RoleGuard = ({ allow, children, loginPath = "/auth" }: Props) => {
  const { user, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRoles();
  const location = useLocation();
  const navigate = useNavigate();

  const ready = !authLoading && !rolesLoading;
  const allowed = ready && !!user && roles.some((r) => allow.includes(r));

  useEffect(() => {
    if (ready && user && !allowed) {
      const need = allow[0];
      const from = location.pathname + location.search;
      toast.error(`需要「${ROLE_CN[need]}」身份`, {
        description: "已为你打开身份切换页",
      });
      navigate(
        `/roles?highlight=${need}&from=${encodeURIComponent(from)}`,
        { replace: true },
      );
    }
  }, [ready, user, allowed, allow, location.pathname, location.search, navigate]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to={loginPath} state={{ from: location.pathname + location.search }} replace />;
  if (!allowed) {
    // 占位，effect 会立即跳转
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return <>{children}</>;
};

export default RoleGuard;
