// 司机端实时定位上报。校验 JWT，且只允许写入自己作为 driver 的订单。
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  order_id: string;
  lat: number;
  lng: number;
  speed?: number | null;
  heading?: number | null;
  distance_km?: number | null;
  eta_minutes?: number | null;
  stage?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authErr } = await userClient.auth.getClaims(token);
    if (authErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const driverId = claimsData.claims.sub as string;

    const body = (await req.json()) as Body;
    if (
      !body?.order_id ||
      typeof body.lat !== "number" ||
      typeof body.lng !== "number" ||
      Math.abs(body.lat) > 90 ||
      Math.abs(body.lng) > 180
    ) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 校验司机身份
    const { data: order } = await userClient
      .from("orders")
      .select("id, driver_id, order_status")
      .eq("id", body.order_id)
      .maybeSingle();

    if (!order || order.driver_id !== driverId) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 找到当前 tracking 行（每订单一行）
    const { data: existing } = await userClient
      .from("trip_tracking")
      .select("id, stage")
      .eq("order_id", body.order_id)
      .maybeSingle();

    const payload: Record<string, unknown> = {
      driver_lat: body.lat,
      driver_lng: body.lng,
      distance_km: body.distance_km ?? null,
      eta_minutes: body.eta_minutes ?? null,
      updated_at: new Date().toISOString(),
    };
    if (body.stage) payload.stage = body.stage;

    if (existing) {
      const { error } = await userClient
        .from("trip_tracking")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await userClient.from("trip_tracking").insert({
        order_id: body.order_id,
        driver_id: driverId,
        stage: body.stage ?? "departed",
        ...payload,
      });
      if (error) throw error;
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[report-location]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
