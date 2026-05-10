// 用户取消订单：校验归属与可取消状态，已支付订单自动触发退款。
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CANCELLABLE = new Set(["created", "confirmed", "pending"]);

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
    const { data: c, error: cErr } = await supabase.auth.getClaims(token);
    if (cErr || !c?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = c.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.order_id || "");
    const reason = String(body?.reason || "用户主动取消").slice(0, 200);
    if (!orderId) {
      return new Response(JSON.stringify({ error: "缺少订单 ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id,user_id,order_status,payment_status,total_amount,is_physical,payment_id")
      .eq("id", orderId)
      .maybeSingle();
    if (oErr || !order) {
      return new Response(JSON.stringify({ error: "订单不存在" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (order.user_id !== userId) {
      return new Response(JSON.stringify({ error: "无权操作" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!CANCELLABLE.has(order.order_status)) {
      return new Response(
        JSON.stringify({ error: `订单当前状态「${order.order_status}」不可取消` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const updates: Record<string, unknown> = {
      order_status: "cancelled",
      updated_at: new Date().toISOString(),
    };

    let refund: { ok: boolean; type: string; amount: number } | null = null;

    if (order.payment_status === "succeeded" && order.payment_id) {
      // 虚拟订单：自动全额退款（写 payment_refunds 标记 auto，状态 succeeded）
      // 实物订单：进入人工审核队列（pending）
      const refundType = order.is_physical ? "manual" : "auto";
      const refundStatus = order.is_physical ? "pending" : "succeeded";
      const { error: rErr } = await admin.from("payment_refunds").insert({
        payment_id: order.payment_id,
        order_id: order.id,
        user_id: userId,
        amount: Number(order.total_amount),
        reason,
        refund_type: refundType,
        status: refundStatus,
      });
      if (rErr) {
        return new Response(JSON.stringify({ error: "退款记录写入失败：" + rErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      updates.refund_status = order.is_physical ? "processing" : "refunded";
      if (!order.is_physical) updates.payment_status = "refunded";
      refund = { ok: true, type: refundType, amount: Number(order.total_amount) };
    }

    await admin.from("orders").update(updates).eq("id", order.id);

    // 通知
    await admin.from("notifications").insert({
      user_id: userId,
      type: "order",
      title: "订单已取消",
      content: refund
        ? refund.type === "auto"
          ? `订单 ${order.id.slice(0, 8)} 已取消，退款 ¥${refund.amount.toFixed(2)} 已原路返回`
          : `订单 ${order.id.slice(0, 8)} 已取消，退款 ¥${refund.amount.toFixed(2)} 待商家审核`
        : `订单 ${order.id.slice(0, 8)} 已取消`,
      related_id: order.id,
    });

    return new Response(JSON.stringify({ ok: true, refund }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
