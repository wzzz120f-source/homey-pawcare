import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import SuperAdminLoginDialog from "@/components/dev/SuperAdminLoginDialog";
import { Button } from "@/components/ui/button";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

const DevEntryPage = () => {
  const [open, setOpen] = useState(true);
  const { isSuperAdmin } = useSuperAdmin();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-5">
        <button onClick={() => navigate("/")} className="absolute top-4 left-4 p-2" aria-label="返回">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">开发者后台</h1>
        <p className="text-sm text-muted-foreground">仅授权超级管理员可进入。</p>
        {isSuperAdmin ? (
          <Button className="w-full" onClick={() => navigate("/__dev/console")}>进入控制台</Button>
        ) : (
          <Button className="w-full" onClick={() => setOpen(true)}>特权账号登录</Button>
        )}
        <SuperAdminLoginDialog open={open} onOpenChange={setOpen} />
      </div>
    </div>
  );
};

export default DevEntryPage;
