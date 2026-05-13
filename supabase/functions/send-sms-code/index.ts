// Send SMS verification code (dev-mode: code is returned to client + logged)
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PHONE_RE = /^1[3-9]\d{9}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { phone } = await req.json();
    if (!phone || !PHONE_RE.test(String(phone))) {
      return new Response(JSON.stringify({ error: "invalid_phone" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate limit: max 1 per 60s, 10 per day
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count: recent } = await admin
      .from("sms_codes").select("id", { count: "exact", head: true })
      .eq("phone", phone).gte("created_at", since);
    if ((recent ?? 0) > 0) {
      return new Response(JSON.stringify({ error: "rate_limited", retry_in: 60 }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { count: dailyCount } = await admin
      .from("sms_codes").select("id", { count: "exact", head: true })
      .eq("phone", phone).gte("created_at", today.toISOString());
    if ((dailyCount ?? 0) >= 10) {
      return new Response(JSON.stringify({ error: "daily_limit" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires_at = new Date(Date.now() + 5 * 60_000).toISOString();
    const { error } = await admin.from("sms_codes").insert({ phone, code, expires_at });
    if (error) throw error;

    // Real SMS gateway integration goes here. In dev/demo mode return the code.
    console.log(`[SMS DEV] phone=${phone} code=${code}`);
    return new Response(JSON.stringify({ ok: true, dev_code: code, expires_in: 300 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-sms-code error", e);
    return new Response(JSON.stringify({ error: "internal", message: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
