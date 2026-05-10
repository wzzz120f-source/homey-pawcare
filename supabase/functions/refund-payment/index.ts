// refund-payment: User/provider/admin triggers refund.
// Calls process_refund RPC. For non-wallet/mock channels (stripe/wechat/alipay),
// then calls the channel's refund API. WeChat/Alipay are stubbed until creds present.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

    const body = await req.json();
    const action: "request" | "process" = body.action;
    if (action === "request") {
      const { data, error } = await userClient.rpc("request_refund", { _order_id: body.order_id, _reason: body.reason ?? null });
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }
    if (action === "process") {
      const { data, error } = await userClient.rpc("process_refund", {
        _refund_id: body.refund_id, _action: body.decision, _note: body.note ?? null,
      });
      if (error) return json({ error: error.message }, 400);
      const res = data as any;
      // For non-wallet approved refunds, call channel API
      if (res?.success && res?.status === "approved" && res?.channel === "stripe") {
        const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data: r } = await admin.from("payment_refunds").select("*, payments!inner(channel_txn_id, client_params, amount)").eq("id", body.refund_id).maybeSingle();
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        const pi = (r?.payments as any)?.channel_txn_id;
        if (stripeKey && pi && pi.startsWith("pi_")) {
          const params = new URLSearchParams();
          params.append("payment_intent", pi);
          params.append("amount", String(Math.round(Number(r!.amount) * 100)));
          const resp = await fetch("https://api.stripe.com/v1/refunds", {
            method: "POST",
            headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: params,
          });
          const sr = await resp.json();
          if (resp.ok) {
            await admin.from("payment_refunds").update({ status: "succeeded", channel_refund_id: sr.id }).eq("id", body.refund_id);
            await admin.from("orders").update({ refund_status: "refunded", payment_status: "refunded" }).eq("id", r!.order_id);
            await admin.from("payments").update({ status: "refunded" }).eq("id", (r!.payments as any).id ?? r!.payment_id);
          }
        }
      }
      return json(res);
    }
    return json({ error: "invalid_action" }, 400);
  } catch (e) {
    console.error("refund-payment", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
