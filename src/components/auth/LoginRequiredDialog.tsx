import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PawPrint, Smartphone, Mail } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  message?: string;
  afterLogin?: () => void;
}

const LoginRequiredDialog = ({ open, onOpenChange, message }: Props) => {
  const navigate = useNavigate();
  const goAuth = (mode: "phone" | "email") => {
    onOpenChange(false);
    const back = window.location.pathname + window.location.search;
    navigate(`/auth?mode=${mode}&redirect=${encodeURIComponent(back)}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
            <PawPrint className="w-7 h-7 text-primary" />
          </div>
          <DialogTitle className="text-center">登录后继续</DialogTitle>
          <DialogDescription className="text-center">
            {message || "请先登录账号，登录后将自动继续你的操作"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          <Button variant="hero" size="xl" className="w-full" onClick={() => goAuth("phone")}>
            <Smartphone className="w-4 h-4 mr-2" /> 手机号一键登录
          </Button>
          <Button variant="outline" size="xl" className="w-full" onClick={() => goAuth("email")}>
            <Mail className="w-4 h-4 mr-2" /> 邮箱登录 / 注册
          </Button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full text-xs text-muted-foreground py-2"
          >
            稍后再说
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginRequiredDialog;
