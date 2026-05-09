import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { GroomerLevel } from "@/components/HealthAssessmentForm";

const VALID: GroomerLevel[] = ["junior", "intermediate", "senior", "expert"];

/**
 * Reads / writes groomer level from public.user_roles.metadata.level
 * for the current user's `groomer` role row.
 */
export const useGroomerLevel = () => {
  const { user } = useAuth();
  const [level, setLevel] = useState<GroomerLevel>("intermediate");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("metadata")
      .eq("user_id", user.id)
      .eq("role", "groomer")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const m = (data?.metadata ?? {}) as Record<string, unknown>;
        const lv = m.level as GroomerLevel | undefined;
        if (lv && VALID.includes(lv)) setLevel(lv);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const update = useCallback(
    async (next: GroomerLevel) => {
      if (!user || !VALID.includes(next)) return { error: "invalid" } as const;
      // Read existing metadata to merge
      const { data: row } = await supabase
        .from("user_roles")
        .select("metadata")
        .eq("user_id", user.id)
        .eq("role", "groomer")
        .maybeSingle();
      const merged = { ...(row?.metadata ?? {}), level: next };
      const { error } = await supabase
        .from("user_roles")
        .update({ metadata: merged })
        .eq("user_id", user.id)
        .eq("role", "groomer");
      if (!error) setLevel(next);
      return { error: error?.message ?? null } as const;
    },
    [user],
  );

  return { level, setLevel: update, loading };
};
