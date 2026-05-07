// AI 陪伴日记生成 edge function
// 输入: { records: string[] (例如 ["09:00 喂食一份湿粮","11:30 散步30分钟"]),
//         pet_name: string, sitter_name?: string }
// 输出: { diary: string } 一段温馨的第一人称（宠托师视角）日记文本
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { records, pet_name, sitter_name } = await req.json();
    if (!Array.isArray(records) || records.length === 0 || !pet_name) {
      return new Response(JSON.stringify({ error: "缺少必要参数 records / pet_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "未配置 LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt =
      "你是一位温柔细致的宠托师，正在写一篇今日陪伴日记给铲屎官。" +
      "请基于服务记录，转化成一段不超过 180 字的温馨日记，第一人称称呼铲屎官的毛孩子用名字，" +
      "包含 1-2 个生动小细节，结尾用一句温暖的祝福，避免任何医疗建议。";

    const userPrompt = `毛孩子名字：${pet_name}\n${sitter_name ? `宠托师：${sitter_name}\n` : ""}今日记录：\n${records.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "请求过于频繁，请稍后再试" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI 额度已用尽，请前往 Cloud 充值" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await resp.text();
      console.error("ai diary error:", resp.status, t);
      return new Response(JSON.stringify({ error: "AI 生成失败" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const diary = data?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ diary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("diary fn error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "未知错误" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
