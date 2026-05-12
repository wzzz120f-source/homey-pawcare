import { Navigate, useLocation } from "react-router-dom";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

const SuperAdminGuard = ({ children }: { children: React.ReactNode }) => {
  const { isSuperAdmin, loading } = useSuperAdmin();
  const loc = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isSuperAdmin) return <Navigate to="/__dev" state={{ from: loc.pathname }} replace />;
  return <>{children}</>;
};

export default SuperAdminGuard;
