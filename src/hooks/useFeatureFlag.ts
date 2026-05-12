import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, boolean>();
const EVT = "feature-flags-refresh";

export const useFeatureFlag = (key: string, fallback = true) => {
  const [enabled, setEnabled] = useState<boolean>(cache.get(key) ?? fallback);
  const [loading, setLoading] = useState(!cache.has(key));

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.from("feature_flags").select("enabled").eq("key", key).maybeSingle();
      if (cancelled) return;
      const v = data?.enabled ?? fallback;
      cache.set(key, v);
      setEnabled(v);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`flag-${key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "feature_flags", filter: `key=eq.${key}` }, () => {
        cache.delete(key);
        load();
      })
      .subscribe();
    const onEvt = () => load();
    window.addEventListener(EVT, onEvt);
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
      window.removeEventListener(EVT, onEvt);
    };
  }, [key, fallback]);

  return { enabled, loading };
};

export const refreshFeatureFlags = () => window.dispatchEvent(new Event(EVT));
