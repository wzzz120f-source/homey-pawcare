import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OwnedMerchant {
  id: string;
  name: string;
  logo_url: string | null;
  is_verified: boolean;
}

/**
 * 返回当前登录用户名下管理的商家列表（基于 merchant_owners 关系）
 */
export const useMerchantOwnership = (userId?: string) => {
  const [merchants, setMerchants] = useState<OwnedMerchant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userId) {
        setMerchants([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("merchant_owners")
        .select("merchant_id, merchants:merchant_id(id, name, logo_url, is_verified)")
        .eq("user_id", userId);
      if (cancelled) return;
      if (error) {
        console.error("load merchant ownership", error);
        setMerchants([]);
      } else {
        const list = (data || [])
          .map((row: any) => row.merchants)
          .filter(Boolean) as OwnedMerchant[];
        setMerchants(list);
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { merchants, loading, isMerchant: merchants.length > 0 };
};
