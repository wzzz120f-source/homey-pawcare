import { supabase } from "@/integrations/supabase/client";

export type SummaryMode = "booking_receipt" | "route_explain" | "booking_advice";

export async function fetchAISummary(
  mode: SummaryMode,
  data: Record<string, unknown>,
): Promise<string> {
  const { data: resp, error } = await supabase.functions.invoke("ai-summary", {
    body: { mode, data },
  });
  if (error) {
    const status = (error as { context?: { status?: number } })?.context?.status;
    if (status === 429) throw new Error("请求过于频繁，请稍后再试");
    if (status === 402) throw new Error("AI 额度不足，请联系管理员");
    throw new Error(error.message || "AI 服务暂时不可用");
  }
  const text = (resp as { text?: string } | null)?.text;
  if (!text) throw new Error("AI 未返回内容");
  return text;
}
