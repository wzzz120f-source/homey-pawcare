// 服务端发放爱心积分，校验每日封顶（100）+ 单动作限频（60s）。
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DAILY_CAP = 100;
const MIN_INTERVAL_MS = 60_000;

const POINTS_BY_ACTION: Record<string, number> = {
  post_create: 10,
  comment_create: 2,
  like_create: 1,
  rescue_feed: 1,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: c, error } = await supabase.auth.getClaims(token);
    if (error || !c?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = c.claims.sub as string;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const relatedType = body?.related_type ? String(body.related_type) : null;
    const relatedId = body?.related_id ? String(body.related_id) : null;
    const description = body?.description ? String(body.description).slice(0, 200) : null;

    const points = POINTS_BY_ACTION[action];
    if (!points) {
      return new Response(JSON.stringify({ error: "未知动作类型" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 频率限制
    const { data: rate } = await admin
      .from("love_points_rate")
      .select("last_at")
      .eq("user_id", userId)
      .eq("action_type", action)
      .maybeSingle();
    if (rate?.last_at) {
      const elapsed = Date.now() - new Date(rate.last_at).getTime();
      if (elapsed < MIN_INTERVAL_MS) {
        return new Response(
          JSON.stringify({
            error: "操作过于频繁，请稍后再试",
            retry_after_ms: MIN_INTERVAL_MS - elapsed,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // 当日封顶
    const today = new Date().toISOString().slice(0, 10);
    const { data: cap } = await admin
      .from("daily_point_caps")
      .select("points_earned")
      .eq("user_id", userId)
      .eq("cap_date", today)
      .maybeSingle();
    const earned = Number(cap?.points_earned || 0);
    if (earned >= DAILY_CAP) {
      return new Response(JSON.stringify({ error: "今日积分已达上限", capped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const grant = Math.min(points, DAILY_CAP - earned);

    // 写入交易 + 更新封顶 + 限频
    await admin.from("love_point_transactions").insert({
      user_id: userId,
      points: grant,
      action_type: action,
      related_type: relatedType,
      related_id: relatedId,
      description,
    });
    await admin.from("daily_point_caps").upsert(
      { user_id: userId, cap_date: today, points_earned: earned + grant },
      { onConflict: "user_id,cap_date" },
    );
    await admin.from("love_points_rate").upsert({
      user_id: userId,
      action_type: action,
      last_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true, granted: grant }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
