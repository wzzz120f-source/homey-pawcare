import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isSuperAdminEmail } from "@/config/superAdmins";

const EVT = "super-admin-refresh";

export const useSuperAdmin = () => {
  const { user, loading: authLoading } = useAuth();
  const [dbFlag, setDbFlag] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user) {
        setDbFlag(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("is_super_admin")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setDbFlag(!!data?.is_super_admin);
        setLoading(false);
      }
    };
    run();
    const onEvt = () => run();
    window.addEventListener(EVT, onEvt);
    return () => {
      cancelled = true;
      window.removeEventListener(EVT, onEvt);
    };
  }, [user]);

  const emailFlag = isSuperAdminEmail(user?.email);
  const isSuperAdmin = !!user && (dbFlag || emailFlag);

  return { isSuperAdmin, loading: authLoading || loading };
};

export const refreshSuperAdmin = () => window.dispatchEvent(new Event(EVT));
