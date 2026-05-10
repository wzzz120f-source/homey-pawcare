// AI 客服：JWT 校验 + 每日限额 + 流式输出
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `你是"爪爪管家"，萌宠到家平台的智能客服与预约助手。你的职责：

【咨询解答】
1. 宠物上门服务（洗澡、美容、遛狗、健康检查、上门喂养）
2. 宠物寄养（酒店房型、价格、入住流程、注意事项）
3. 宠物接送（专车/拼车、价格估算、宠物运输安全）
4. 商城商品、订单、售后、退换货
5. 宠物健康、饮食、训练等专业建议

【预约引导】当用户表达预约意向时，按以下顺序引导：
- 上门服务 → 询问宠物类型/体型 → 服务项目 → 时间 → 地址 → 引导前往「首页 - 服务」下单
- 宠物寄养 → 询问宠物类型/数量 → 入住时间 → 是否需要接送 → 引导前往「宠物酒店」选择门店
- 宠物接送 → 询问宠物类型 → 上车点/下车点 → 时间 → 引导前往「接送预约」填写

【关键政策】
- 退款：7天无理由退换货 | 发货：48小时内
- 接送：5kg内宠物可拼车，大型犬建议专车
- 寄养：需提供疫苗证明，押金可抵扣消费
- 上门服务：技师持证上岗，全程可视化

【沟通风格】
- 友好专业，适当使用 🐾 🐶 🐱 ✨ 等emoji
- 回答简洁，关键信息用 markdown 列表呈现
- 不确定时引导联系人工客服或前往对应页面
- 主动追问缺失的预约要素，一次问1-2个问题`;

const DAILY_LIMIT = 50;
const MAX_MESSAGES = 30;
const MAX_CHARS = 2000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claimsData?.claims?.sub) return json({ error: "unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    // 入参校验
    const body = await req.json().catch(() => null);
    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
      return json({ error: "invalid_messages" }, 400);
    }
    for (const m of messages) {
      if (
        !m ||
        typeof m.content !== "string" ||
        m.content.length > MAX_CHARS ||
        !["user", "assistant", "system"].includes(m.role)
      ) {
        return json({ error: "invalid_message_shape" }, 400);
      }
    }

    // 限流
    const { data: quotaRes, error: quotaErr } = await supabase.rpc(
      "increment_ai_chat_quota",
      { _uid: userId, _max: DAILY_LIMIT },
    );
    if (quotaErr) {
      console.error("quota error", quotaErr);
    } else if (quotaRes && (quotaRes as any).ok === false) {
      const r = quotaRes as any;
      if (r.error === "rate_limited") {
        return json(
          { error: "rate_limited", message: `今日 AI 客服已用完 ${r.max} 次，明天再来吧 🐾` },
          429,
        );
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "ai_not_configured" }, 500);

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) return json({ error: "rate_limited", message: "AI 网关繁忙，请稍后" }, 429);
      if (upstream.status === 402) return json({ error: "credits_exhausted", message: "AI 服务额度不足" }, 402);
      const t = await upstream.text();
      console.error("AI gateway error", upstream.status, t);
      return json({ error: "ai_unavailable" }, 502);
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("[chat-ai]", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
