import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let prevUserId: string | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id ?? null;
      // Clear role override whenever the authenticated user changes (sign-in / sign-out / switch account)
      // Prevents previous session's "active_role_override" from forcing a wrong role view.
      if (event === "SIGNED_OUT" || (nextUserId && nextUserId !== prevUserId)) {
        try { localStorage.removeItem("active_role_override"); } catch {}
        try { window.dispatchEvent(new Event("active-role-change")); } catch {}
      }
      prevUserId = nextUserId;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      prevUserId = session?.user?.id ?? null;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try { localStorage.removeItem("active_role_override"); } catch {}
    await supabase.auth.signOut();
  };

  return { user, loading, signOut };
};
