import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

export type AppRole = "admin" | "merchant" | "user" | "sitter" | "groomer" | "driver" | "hotel_owner";
export type ActiveRole = "user" | "sitter" | "groomer" | "driver" | "merchant" | "admin" | "hotel_owner";

const STORAGE_KEY = "active_role_override";
const EVT = "active-role-change";

const ALL_ROLES: ActiveRole[] = ["user", "sitter", "groomer", "driver", "merchant", "admin", "hotel_owner"];

const readOverride = (): ActiveRole | null => {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY) as ActiveRole | null;
  // Migrate legacy "worker" override
  if ((v as string) === "worker") {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  return v && ALL_ROLES.includes(v) ? v : null;
};

const writeOverride = (role: ActiveRole | null) => {
  if (typeof window === "undefined") return;
  if (role) localStorage.setItem(STORAGE_KEY, role);
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(EVT));
};

const computeDefault = (roles: AppRole[]): ActiveRole =>
  roles.includes("admin")
    ? "admin"
    : roles.includes("merchant")
    ? "merchant"
    : roles.includes("sitter")
    ? "sitter"
    : roles.includes("groomer")
    ? "groomer"
    : roles.includes("driver")
    ? "driver"
    : "user";

export const useUserRoles = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [override, setOverride] = useState<ActiveRole | null>(() => readOverride());

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("hotel_owners").select("id").eq("user_id", user.id).limit(1),
    ]).then(([rolesRes, hotelRes]) => {
      if (cancelled) return;
      const list = (rolesRes.data ?? []).map((r: any) => r.role as AppRole);
      if ((hotelRes.data ?? []).length > 0 && !list.includes("hotel_owner")) {
        list.push("hotel_owner");
      }
      setRoles(list);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Listen to override changes from other components / tabs
  useEffect(() => {
    const onChange = () => setOverride(readOverride());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const defaultRole = computeDefault(roles);

  // Available roles user is allowed to switch into
  const { isSuperAdmin } = useSuperAdmin();
  const availableRoles: ActiveRole[] = ["user"];
  if (isSuperAdmin) {
    availableRoles.push("sitter", "groomer", "driver", "merchant", "admin", "hotel_owner");
  } else {
    if (roles.includes("sitter")) availableRoles.push("sitter");
    if (roles.includes("groomer")) availableRoles.push("groomer");
    if (roles.includes("driver")) availableRoles.push("driver");
    if (roles.includes("merchant")) availableRoles.push("merchant");
    if (roles.includes("admin")) availableRoles.push("admin");
    if (roles.includes("hotel_owner")) availableRoles.push("hotel_owner");
  }

  const activeRole: ActiveRole =
    override && availableRoles.includes(override) ? override : defaultRole;

  // Apply data-role to <html> for theming
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.role = activeRole;
    }
  }, [activeRole]);

  const setActiveRole = useCallback((r: ActiveRole | null) => writeOverride(r), []);

  return {
    roles,
    activeRole,
    availableRoles,
    setActiveRole,
    loading,
    isAdmin: roles.includes("admin"),
  };
};
