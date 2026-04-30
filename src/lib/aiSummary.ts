import { supabase } from "@/integrations/supabase/client";

export type SummaryMode =
  | "booking_receipt"
  | "route_explain"
  | "booking_advice"
  | "route_timeline";

export type AIErrorKind = "rate_limit" | "credit" | "network" | "unknown";

export class AIServiceError extends Error {
  kind: AIErrorKind;
  status?: number;
  constructor(message: string, kind: AIErrorKind, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

export interface AdvicePlan {
  title: string;
  summary: string;
  pros: string[];
  cons: string[];
  reason: string;
  recommended?: boolean;
}

export interface TimelineStep {
  time: string; // 例如 "T-5min"
  title: string;
  detail: string;
  wait?: string; // 建议等待时长
}

export interface AISummaryResponse {
  text?: string;
  plans?: AdvicePlan[];
  timeline?: TimelineStep[];
}

const FALLBACK_TEXT: Record<SummaryMode, string> = {
  booking_receipt:
    "AI 摘要暂不可用，请直接查看上方订单详情。如需帮助可联系人工客服或在「我的订单」中复用本次草稿。",
  route_explain:
    "AI 路线解读暂不可用。请确认上下车地址与时间是否合理，或联系人工客服协助核对。",
  booking_advice:
    "AI 建议暂不可用，建议先核对宠物类型、备注与接送方式后再提交。需要帮助可转人工客服。",
  route_timeline:
    "AI 流程清单暂不可用。建议提前 5 分钟到达上车点，准备好牵引绳与航空箱。",
};

export function getOfflineFallback(mode: SummaryMode): string {
  return FALLBACK_TEXT[mode];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch AI summary with one automatic retry for transient errors.
 * Throws AIServiceError so UI can show 人工客服 / 草稿 引导.
 */
export async function fetchAISummary(
  mode: SummaryMode,
  data: Record<string, unknown>,
  options: { retry?: number; signal?: AbortSignal } = {},
): Promise<AISummaryResponse> {
  const maxRetry = options.retry ?? 1;
  let attempt = 0;
  let lastErr: AIServiceError | null = null;

  while (attempt <= maxRetry) {
    if (options.signal?.aborted) throw new AIServiceError("已取消", "unknown");
    try {
      const { data: resp, error } = await supabase.functions.invoke("ai-summary", {
        body: { mode, data },
      });
      if (error) {
        const status = (error as { context?: { status?: number } })?.context?.status;
        if (status === 429) throw new AIServiceError("请求过于频繁，请稍后再试", "rate_limit", 429);
        if (status === 402) throw new AIServiceError("AI 额度不足", "credit", 402);
        throw new AIServiceError(error.message || "AI 服务暂时不可用", "network", status);
      }
      const r = resp as AISummaryResponse | null;
      if (!r || (!r.text && !r.plans && !r.timeline)) {
        throw new AIServiceError("AI 未返回内容", "unknown");
      }
      return r;
    } catch (e) {
      const err =
        e instanceof AIServiceError
          ? e
          : new AIServiceError(
              e instanceof Error ? e.message : "网络异常",
              "network",
            );
      lastErr = err;
      // Do not retry on quota/rate-limit errors — surface immediately.
      if (err.kind === "rate_limit" || err.kind === "credit") break;
      attempt += 1;
      if (attempt > maxRetry) break;
      await sleep(400 * attempt); // simple backoff
    }
  }

  throw lastErr ?? new AIServiceError("AI 服务暂时不可用", "unknown");
}

/** Convenience: text-only fetch with offline fallback (never throws). */
export async function fetchAISummaryTextSafe(
  mode: SummaryMode,
  data: Record<string, unknown>,
): Promise<{ text: string; error?: AIServiceError }> {
  try {
    const r = await fetchAISummary(mode, data);
    return { text: r.text ?? getOfflineFallback(mode) };
  } catch (e) {
    const err = e instanceof AIServiceError ? e : new AIServiceError("AI 服务暂时不可用", "unknown");
    return { text: getOfflineFallback(mode), error: err };
  }
}
