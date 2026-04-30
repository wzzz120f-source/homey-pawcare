import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Mode = "booking_receipt" | "route_explain" | "booking_advice" | "route_timeline";

interface Payload {
  mode: Mode;
  data: Record<string, unknown>;
}

function buildSystem(mode: Mode): string {
  if (mode === "booking_receipt") {
    return "你是萌宠到家平台的预约助手。基于结构化订单信息，生成 80-140 字、温暖友好的中文订单摘要。突出 时间 / 宠物类型 / 备注 / 技师或门店 / 预计上门或接送时间；使用 markdown，关键信息用 **加粗** 或 emoji 高亮；不要罗列字段名。";
  }
  if (mode === "route_explain") {
    return "你是萌宠到家的接送顾问。用 60-100 字、通俗易懂的中文，解释路线/耗时是否合理，并给出 上车点 / 下车点 注意事项。使用 markdown 列表，避免技术术语。";
  }
  if (mode === "route_timeline") {
    return `你是萌宠到家的接送流程教练。基于路线信息，输出一个 4-6 步的"上车/下车流程时间线"。
严格返回 JSON（不要 markdown 代码块包裹），结构：
{"timeline":[{"time":"T-10min","title":"准备出行","detail":"…","wait":"约 10 分钟"}, …]}
要求：
- time 用相对时间标签（T-10min / T-5min / T0 / T+15min 等）
- title 6-10 字简短动作；detail 20-40 字操作要点（牵引绳、航空箱、电话沟通、签到等）
- wait 字段填写"建议等待时长"（如"约 5 分钟"），无需等待可省略
- 至少包含：行前准备、上车交接、行程中、下车交接 4 个关键节点`;
  }
  // booking_advice → multi-plan
  return `你是萌宠到家的 AI 预约助手。基于用户选择的 宠物类型 / 备注 / 接送方式 / 服务类型，生成 2-3 个可选预约方案（例如不同技师/时段/接送档位），帮助用户对比。
严格返回 JSON（不要 markdown 代码块包裹），结构：
{"plans":[{"title":"方案名（10字内）","summary":"一句话说明（25字内）","pros":["优点1","优点2"],"cons":["缺点1"],"reason":"推荐理由（30字内）","recommended":true,"applyTo":{"suggestedTime":"10:00-11:00","suggestedTier":"express","suggestedDriverGender":"any","suggestedTimeMode":"scheduled","suggestedNote":"提前 5 分钟到达","lockFields":["time","tier"]}}]}
要求：
- 输出 2-3 个 plan，且仅 1 个 recommended:true
- pros 至少 2 条、cons 至少 1 条，简短可对比
- 中文，亲切但克制 emoji（每个 plan 最多 1 个）
- applyTo 可选；若给出则 lockFields 必须仅包含真正建议锁定的字段（time/tier/gender/timeMode/notes 之一或多个）
- suggestedTime 必须是 HH:MM-HH:MM 形式；suggestedTier 仅可为 share/express/night/luxury 之一`;
}

function safeParseJSON<T>(s: string): T | null {
  try {
    // strip markdown fences if model still returned them
    const cleaned = s.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = (await req.json()) as Payload;
    if (!payload?.mode || !payload?.data) {
      return new Response(JSON.stringify({ error: "mode 和 data 必填" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const system = buildSystem(payload.mode);
    const user = `输入信息（JSON）：\n${JSON.stringify(payload.data, null, 2)}\n\n请按要求生成：`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "请求过于频繁，请稍后再试" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI 服务额度不足，请充值" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("ai-summary gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI 服务暂时不可用" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await response.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";

    if (payload.mode === "booking_advice") {
      const parsed = safeParseJSON<{ plans?: unknown[] }>(content);
      if (parsed?.plans && Array.isArray(parsed.plans)) {
        return new Response(JSON.stringify({ plans: parsed.plans }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Fallback: return raw text so the client can still display something.
      return new Response(JSON.stringify({ text: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.mode === "route_timeline") {
      const parsed = safeParseJSON<{ timeline?: unknown[] }>(content);
      if (parsed?.timeline && Array.isArray(parsed.timeline)) {
        return new Response(JSON.stringify({ timeline: parsed.timeline }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ text: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ text: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
