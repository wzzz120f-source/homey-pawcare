import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Mode = "booking_receipt" | "route_explain" | "booking_advice";

interface Payload {
  mode: Mode;
  data: Record<string, unknown>;
}

function buildPrompt({ mode, data }: Payload): { system: string; user: string } {
  if (mode === "booking_receipt") {
    return {
      system:
        "你是萌宠到家平台的预约助手。基于结构化订单信息，生成一段 80-140 字、温暖友好的中文订单摘要。要求：突出 时间 / 宠物类型 / 备注 / 技师或门店 / 预计上门或接送时间；使用 markdown，关键信息用 **加粗** 或 emoji 高亮；不要罗列字段名。",
      user: `订单信息（JSON）：\n${JSON.stringify(data, null, 2)}\n\n请生成订单摘要：`,
    };
  }
  if (mode === "route_explain") {
    return {
      system:
        "你是萌宠到家的接送顾问。用户即将通过高德地图预约宠物接送。请用 60-100 字、通俗易懂的中文，向用户解释路线/耗时是否合理，并给出 上车点 / 下车点 的注意事项（例如等候位置、宠物携带要求、避免高峰时段等）。使用 markdown 列表，避免技术术语。",
      user: `接送路线信息：\n${JSON.stringify(data, null, 2)}\n\n请给出通俗解释与上下车提示：`,
    };
  }
  // booking_advice
  return {
    system:
      "你是萌宠到家的 AI 预约助手。基于用户选择的 宠物类型 / 备注 / 接送方式 / 服务类型，生成一段 100-160 字的中文预约建议。包含：① 1-2 条预约小贴士 ② 2-3 条注意事项（安全/卫生/沟通）。使用 markdown 列表，前缀 emoji，语气亲切。",
    user: `用户预约选择：\n${JSON.stringify(data, null, 2)}\n\n请生成预约建议与注意事项：`,
  };
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

    const { system, user } = buildPrompt(payload);

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
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ text }), {
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
