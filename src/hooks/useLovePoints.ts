import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * 爱心积分 (Love Points) 经济体系
 *
 * 赚取规则（标准方案，每日封顶 100）:
 *  - 发帖 (post_create)        +10
 *  - 被点赞 (post_liked)        +2
 *  - 云投喂 (cloud_feed)        +5
 *  - 提供线索 (clue_submit)     +20
 *  - 走失登记 (lost_pet_report) +15
 *
 * 消费场景:
 *  - 商城抵现：100 积分 = 1 元，单笔订单最多抵 20%
 *  - 积分专区：固定积分兑换实物/优惠券/虚拟勋章
 *  - 公益捐赠：转捐至"平台公益池"或具体救助故事
 */

export const POINT_RULES = {
  post_create: 10,
  post_liked: 2,
  cloud_feed: 5,
  clue_submit: 20,
  lost_pet_report: 15,
} as const;

export type PointAction = keyof typeof POINT_RULES;

const ACTION_LABELS: Record<string, string> = {
  post_create: "发布动态",
  post_liked: "动态被点赞",
  cloud_feed: "云投喂爱心粮",
  clue_submit: "提供寻宠线索",
  lost_pet_report: "登记走失宠物",
  redeem: "积分兑换",
  donate: "公益捐赠",
  exchange: "商城抵现",
};

export const getActionLabel = (action: string) => ACTION_LABELS[action] ?? action;

export const useLovePoints = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setBalance(0);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("love_points")
      .eq("user_id", user.id)
      .maybeSingle();
    setBalance(data?.love_points ?? 0);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** 静默发放积分（不打扰用户）。返回实际入账积分（受每日封顶限制）。 */
  const award = useCallback(
    async (
      action: PointAction,
      relatedType?: string,
      relatedId?: string,
    ): Promise<number> => {
      if (!user) return 0;
      const points = POINT_RULES[action];
      const { data, error } = await (supabase as any).rpc("award_love_points", {
        _action: action,
        _points: points,
        _related_type: relatedType ?? null,
        _related_id: relatedId ?? null,
        _description: getActionLabel(action),
      });
      if (error || !data?.success) return 0;
      const granted: number = data.granted ?? 0;
      if (granted > 0) {
        setBalance((prev) => prev + granted);
        toast.success(`+${granted} 爱心积分`, {
          description: getActionLabel(action),
          duration: 2000,
        });
      }
      return granted;
    },
    [user],
  );

  /** 消费积分（兑换/抵现）。 */
  const spend = useCallback(
    async (
      points: number,
      purpose: "redeem" | "exchange",
      relatedType?: string,
      relatedId?: string,
      description?: string,
    ): Promise<boolean> => {
      if (!user) {
        toast.error("请先登录");
        return false;
      }
      setLoading(true);
      const { data, error } = await (supabase as any).rpc("spend_love_points", {
        _points: points,
        _purpose: purpose,
        _related_type: relatedType ?? null,
        _related_id: relatedId ?? null,
        _description: description ?? null,
      });
      setLoading(false);
      if (error || !data?.success) {
        toast.error(data?.error === "insufficient" ? "积分不足" : "兑换失败");
        return false;
      }
      setBalance(data.remaining ?? 0);
      return true;
    },
    [user],
  );

  /** 公益捐赠 */
  const donate = useCallback(
    async (
      points: number,
      target: { type: "platform_pool" | "rescue_story"; id?: string | null },
      message?: string,
    ): Promise<boolean> => {
      if (!user) {
        toast.error("请先登录");
        return false;
      }
      setLoading(true);
      const { data, error } = await (supabase as any).rpc("donate_love_points", {
        _points: points,
        _target_type: target.type,
        _target_id: target.id ?? null,
        _message: message ?? null,
      });
      setLoading(false);
      if (error || !data?.success) {
        toast.error(data?.error === "insufficient" ? "积分不足" : "捐赠失败");
        return false;
      }
      setBalance(data.remaining ?? 0);
      toast.success("感谢你的爱心 ❤️", { description: `已捐出 ${points} 积分` });
      return true;
    },
    [user],
  );

  return { balance, loading, refresh, award, spend, donate };
};
