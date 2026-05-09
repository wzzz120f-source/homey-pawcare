import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles, type AppRole } from "@/hooks/useUserRoles";

interface Props {
  allow: AppRole[];
  children: React.ReactNode;
  /** 未登录时跳转，默认 /auth */
  loginPath?: string;
  /** 越权时跳转，默认 / */
  fallbackPath?: string;
}

/**
 * 路由级角色守卫：未登录跳 /auth，越权跳首页并 toast。
 * 角色判定基于 user_roles 表，避免任何客户端硬编码。
 */
const RoleGuard = ({ allow, children, loginPath = "/auth", fallbackPath = "/" }: Props) => {
  const { user, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRoles();
  const location = useLocation();

  const ready = !authLoading && !rolesLoading;
  const allowed = ready && !!user && roles.some((r) => allow.includes(r));

  useEffect(() => {
    if (ready && user && !allowed) {
      toast.error("没有访问权限", { description: "请切换到对应角色后再试" });
    }
  }, [ready, user, allowed]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to={loginPath} state={{ from: location.pathname }} replace />;
  if (!allowed) return <Navigate to={fallbackPath} replace />;
  return <>{children}</>;
};

export default RoleGuard;
