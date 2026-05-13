// Verify SMS code, create or sign-in user, return session.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PHONE_RE = /^1[3-9]\d{9}$/;
const PHONE_DOMAIN = "phone.local";

// Deterministic password derivation (server-only). Used so existing accounts
// can sign back in via password after creation. Treat as a server secret.
async function derivePassword(phone: string): Promise<string> {
  const secret = Deno.env.get("PHONE_AUTH_SECRET") ?? "homey-pawcare-default-pepper";
  const data = new TextEncoder().encode(`${secret}:${phone}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { phone, code } = await req.json();
    if (!PHONE_RE.test(String(phone || ""))) {
      return new Response(JSON.stringify({ error: "invalid_phone" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^\d{4,8}$/.test(String(code || ""))) {
      return new Response(JSON.stringify({ error: "invalid_code" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Find latest unconsumed code
    const { data: rows } = await admin
      .from("sms_codes").select("*")
      .eq("phone", phone).is("consumed_at", null)
      .order("created_at", { ascending: false }).limit(1);
    const row = rows?.[0];
    if (!row || row.code !== String(code) || new Date(row.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "wrong_or_expired" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await admin.from("sms_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);

    const password = await derivePassword(phone);
    const email = `${phone}@${PHONE_DOMAIN}`;

    // Try to find existing mapping
    let userId: string | undefined;
    const { data: mapping } = await admin
      .from("phone_accounts").select("user_id").eq("phone", phone).maybeSingle();
    userId = mapping?.user_id;

    if (!userId) {
      // Create user with email confirmed
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { phone, login_method: "phone" },
      });
      if (createErr || !created.user) {
        return new Response(JSON.stringify({ error: "create_failed", message: createErr?.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = created.user.id;
      await admin.from("phone_accounts").insert({ phone, user_id: userId });
      await admin.from("profiles").update({ phone }).eq("user_id", userId);
    }

    // Sign in via anon client to obtain a session
    const anon = createClient(SUPABASE_URL, ANON);
    const { data: signed, error: signErr } = await anon.auth.signInWithPassword({ email, password });
    if (signErr || !signed.session) {
      return new Response(JSON.stringify({ error: "signin_failed", message: signErr?.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        access_token: signed.session.access_token,
        refresh_token: signed.session.refresh_token,
        user_id: userId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("verify-sms-code error", e);
    return new Response(JSON.stringify({ error: "internal", message: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
