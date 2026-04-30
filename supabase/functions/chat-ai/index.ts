import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
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
        return new Response(JSON.stringify({ error: "AI服务额度不足" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI服务暂时不可用" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
