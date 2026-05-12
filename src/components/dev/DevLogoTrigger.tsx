import { useRef, useState, useCallback } from "react";
import SuperAdminLoginDialog from "./SuperAdminLoginDialog";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useNavigate } from "react-router-dom";

/** 包裹版权区文字：2 秒内连点 7 次唤起特权登录 */
const DevLogoTrigger = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const tapsRef = useRef<number[]>([]);
  const { isSuperAdmin } = useSuperAdmin();
  const navigate = useNavigate();

  const handleTap = useCallback(() => {
    const now = Date.now();
    tapsRef.current = [...tapsRef.current.filter((t) => now - t < 2000), now];
    if (tapsRef.current.length >= 7) {
      tapsRef.current = [];
      if (isSuperAdmin) navigate("/__dev/console");
      else setOpen(true);
    }
  }, [isSuperAdmin, navigate]);

  return (
    <>
      <div onClick={handleTap} role="presentation">{children}</div>
      <SuperAdminLoginDialog open={open} onOpenChange={setOpen} />
    </>
  );
};

export default DevLogoTrigger;
