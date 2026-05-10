// Create-payment Edge Function
// Creates a payment intent in DB and pre-orders with the chosen channel.
// Channels: wallet (instant) | stripe | wechat | alipay | mock
// If channel-specific secrets are missing, falls back to MOCK mode automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateBody {
  order_id: string;
  channel: "wallet" | "stripe" | "wechat" | "alipay" | "mock";
  return_url?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
    if (cErr || !claims?.claims?.sub) return json({ error: "unauthorized" }, 401);
    const userId = claims.claims.sub;

    const body = (await req.json()) as CreateBody;
    if (!body?.order_id || !body?.channel) return json({ error: "bad_request" }, 400);

    // 1) Create / reuse payment intent via RPC (validates order ownership + amount)
    const { data: rpcData, error: rpcErr } = await supabase.rpc("create_payment_intent", {
      _order_id: body.order_id,
      _channel: body.channel,
      _idempotency_key: crypto.randomUUID(),
    });
    if (rpcErr) return json({ error: rpcErr.message }, 400);
    if (!(rpcData as any)?.success) return json({ error: (rpcData as any)?.error ?? "rpc_failed" }, 400);
    const paymentId: string = (rpcData as any).payment_id;
    const amount: number = Number((rpcData as any).amount ?? 0);

    // 2) Wallet — settle immediately via mark_payment_succeeded (service role to bypass)
    if (body.channel === "wallet") {
      const adminSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      // pre-check balance
      const { data: w } = await adminSb.from("user_wallets").select("balance").eq("user_id", userId).maybeSingle();
      if (!w || Number(w.balance) < amount) {
        await adminSb.rpc("mark_payment_failed", { _payment_id: paymentId, _payload: { reason: "insufficient_wallet" } });
        return json({ error: "insufficient_wallet", payment_id: paymentId }, 400);
      }
      const { data: r2, error: e2 } = await adminSb.rpc("mark_payment_succeeded", {
        _payment_id: paymentId,
        _channel_txn_id: `WALLET-${Date.now()}`,
        _amount: amount,
        _payload: { source: "wallet" },
      });
      if (e2 || !(r2 as any)?.success) return json({ error: "wallet_pay_failed" }, 500);
      return json({ payment_id: paymentId, channel: "wallet", status: "succeeded" });
    }

    // 3) Stripe — create Checkout Session if key present, else mock
    if (body.channel === "stripe") {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) {
        return json({ payment_id: paymentId, channel: "stripe", mode: "mock", checkout_url: null, mock: true });
      }
      const successUrl = (body.return_url ?? `${req.headers.get("origin") ?? ""}/payment/result/${body.order_id}`) + `?pid=${paymentId}`;
      const params = new URLSearchParams();
      params.append("mode", "payment");
      params.append("success_url", successUrl);
      params.append("cancel_url", successUrl);
      params.append("client_reference_id", paymentId);
      params.append("metadata[payment_id]", paymentId);
      params.append("line_items[0][price_data][currency]", "cny");
      params.append("line_items[0][price_data][product_data][name]", `Order ${body.order_id.slice(0, 8)}`);
      params.append("line_items[0][price_data][unit_amount]", String(Math.round(amount * 100)));
      params.append("line_items[0][quantity]", "1");

      const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });
      const sess = await resp.json();
      if (!resp.ok) return json({ error: "stripe_failed", detail: sess }, 502);
      // store session id for query-payment
      await createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
        .from("payments").update({ channel_txn_id: sess.id, client_params: { session_id: sess.id } }).eq("id", paymentId);
      return json({ payment_id: paymentId, channel: "stripe", checkout_url: sess.url, session_id: sess.id });
    }

    // 4) WeChat / Alipay — credentials likely missing → return mock checkout
    if (body.channel === "wechat" || body.channel === "alipay") {
      const required = body.channel === "wechat" ? ["WECHAT_MCH_ID", "WECHAT_API_V3_KEY"] : ["ALIPAY_APP_ID", "ALIPAY_APP_PRIVATE_KEY"];
      const hasCreds = required.every((k) => !!Deno.env.get(k));
      if (!hasCreds) {
        return json({ payment_id: paymentId, channel: body.channel, mode: "mock", mock: true });
      }
      // TODO: real WeChat V3 / Alipay implementation when secrets are configured
      return json({ payment_id: paymentId, channel: body.channel, mode: "mock", mock: true, note: "real-impl-pending" });
    }

    // 5) Mock channel — explicit mock
    return json({ payment_id: paymentId, channel: "mock", mode: "mock", mock: true });
  } catch (e) {
    console.error("create-payment error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
