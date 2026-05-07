import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "admin" | "merchant" | "user" | "sitter" | "groomer";
export type ActiveRole = "user" | "worker" | "merchant" | "admin";

export const useUserRoles = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        setRoles((data ?? []).map((r: any) => r.role as AppRole));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // 主角色优先级：admin > merchant > worker(sitter|groomer) > user
  const activeRole: ActiveRole = roles.includes("admin")
    ? "admin"
    : roles.includes("merchant")
    ? "merchant"
    : roles.includes("sitter") || roles.includes("groomer")
    ? "worker"
    : "user";

  return { roles, activeRole, loading, isAdmin: roles.includes("admin") };
};
