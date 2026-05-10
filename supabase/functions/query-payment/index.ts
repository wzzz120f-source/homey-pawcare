// query-payment: Polls payment status. For Stripe queries the session.
// For mock channels, accepts ?action=succeed|fail to simulate.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(token);
    if (!claims?.claims?.sub) return json({ error: "unauthorized" }, 401);
    const userId = claims.claims.sub;

    const body = await req.json().catch(() => ({}));
    const paymentId: string | undefined = body.payment_id;
    const action: string | undefined = body.action; // 'succeed' | 'fail' for mock
    if (!paymentId) return json({ error: "payment_id_required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: p, error } = await admin.from("payments").select("*").eq("id", paymentId).maybeSingle();
    if (error || !p) return json({ error: "not_found" }, 404);
    if (p.user_id !== userId) return json({ error: "forbidden" }, 403);

    if (p.status !== "pending") return json({ payment_id: paymentId, status: p.status });

    // Mock channels: accept manual action from frontend (dev mode)
    if (p.channel === "mock" || p.channel === "wechat" || p.channel === "alipay") {
      if (action === "succeed") {
        await admin.rpc("mark_payment_succeeded", {
          _payment_id: paymentId,
          _channel_txn_id: `MOCK-${Date.now()}`,
          _amount: Number(p.amount),
          _payload: { source: "mock", action },
        });
        return json({ payment_id: paymentId, status: "succeeded" });
      }
      if (action === "fail") {
        await admin.rpc("mark_payment_failed", { _payment_id: paymentId, _payload: { source: "mock", action } });
        return json({ payment_id: paymentId, status: "failed" });
      }
      return json({ payment_id: paymentId, status: "pending", mock: true });
    }

    // Stripe: query checkout session
    if (p.channel === "stripe") {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      const sessionId = (p.client_params as any)?.session_id ?? p.channel_txn_id;
      if (!stripeKey || !sessionId) return json({ payment_id: paymentId, status: "pending" });
      const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      const sess = await r.json();
      if (!r.ok) return json({ payment_id: paymentId, status: "pending", warn: sess });
      if (sess.payment_status === "paid") {
        await admin.rpc("mark_payment_succeeded", {
          _payment_id: paymentId,
          _channel_txn_id: sess.payment_intent ?? sessionId,
          _amount: Number(p.amount),
          _payload: { stripe_session_id: sessionId, payment_intent: sess.payment_intent },
        });
        return json({ payment_id: paymentId, status: "succeeded" });
      }
      return json({ payment_id: paymentId, status: "pending" });
    }

    return json({ payment_id: paymentId, status: "pending" });
  } catch (e) {
    console.error("query-payment error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
