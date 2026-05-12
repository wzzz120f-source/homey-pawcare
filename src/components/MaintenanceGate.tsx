import { useLocation } from "react-router-dom";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Wrench } from "lucide-react";

const ALLOW_PATHS = ["/__dev", "/auth"];

const MaintenanceGate = ({ children }: { children: React.ReactNode }) => {
  const { enabled: maintenance, loading } = useFeatureFlag("maintenance_mode", false);
  const { isSuperAdmin } = useSuperAdmin();
  const loc = useLocation();
  const isAllowed = ALLOW_PATHS.some((p) => loc.pathname.startsWith(p));

  if (loading || !maintenance || isSuperAdmin || isAllowed) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-sm text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Wrench className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-xl font-bold">系统维护中</h1>
        <p className="text-sm text-muted-foreground">我们正在升级服务，请稍后再来。给您带来的不便，敬请谅解。</p>
      </div>
    </div>
  );
};

export default MaintenanceGate;
