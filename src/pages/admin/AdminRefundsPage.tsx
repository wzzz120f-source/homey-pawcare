import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, RefreshCw, CheckCircle2, XCircle, Loader2, Package, Sparkles,
  Eye, FileText, ExternalLink, Wallet, CreditCard, Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import AdminConfirmDialog from "@/components/AdminConfirmDialog";
import { friendlySupabaseError } from "@/lib/supabaseError";

interface RefundRow {
  id: string;
  payment_id: string;
  order_id: string;
  user_id: string;
  amount: number;
  reason: string | null;
  status: string;
  refund_type: string;
  channel_refund_id: string | null;
  operator_id: string | null;
  operator_note: string | null;
  created_at: string;
  updated_at: string;
  orders?: {
    order_no: string; is_physical: boolean;
    payment_method: string | null;
    total_amount: number;
    pickup_address: string | null;
    dropoff_address: string | null;
    notes: string | null;
    user_id: string;
    driver_id: string | null;
  } | null;
  payments?: { channel: string; channel_txn_id: string | null; paid_at: string | null } | null;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "待审核", cls: "bg-amber-100 text-amber-700" },
  approved: { label: "已批准·渠道处理中", cls: "bg-blue-100 text-blue-700" },
  succeeded: { label: "已退款", cls: "bg-green-100 text-green-700" },
  rejected: { label: "已驳回", cls: "bg-red-100 text-red-700" },
  failed: { label: "退款失败", cls: "bg-red-100 text-red-700" },
};

const CHANNEL_META: Record<string, { label: string; icon: typeof Wallet; color: string }> = {
  wallet: { label: "钱包", icon: Wallet, color: "text-primary" },
  stripe: { label: "Stripe", icon: CreditCard, color: "text-amber-600" },
  wechat: { label: "微信", icon: Smartphone, color: "text-green-600" },
  alipay: { label: "支付宝", icon: Smartphone, color: "text-blue-500" },
  mock: { label: "模拟", icon: Wallet, color: "text-muted-foreground" },
};

const AdminRefundsPage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");
  const [detail, setDetail] = useState<RefundRow | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ r: RefundRow; action: "approve" | "reject"; note: string } | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("payment_refunds")
      .select("*, orders(order_no, is_physical, payment_method, total_amount, pickup_address, dropoff_address, notes, user_id, driver_id), payments(channel, channel_txn_id, paid_at)")
      .order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) toast.error("加载失败：" + error.message);
    else setRows((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [filter]);

  const requestHandle = (r: RefundRow, action: "approve" | "reject") => {
    const note = action === "reject"
      ? window.prompt("驳回原因（必填）：")
      : (window.prompt("审核备注（可选）：") ?? "");
    if (action === "reject" && !note) return;
    setPendingConfirm({ r, action, note: note ?? "" });
  };

  const executeHandle = async () => {
    if (!pendingConfirm) return;
    const { r, action, note } = pendingConfirm;
    setProcessing(r.id);
    const { data, error } = await supabase.rpc("process_refund", { _refund_id: r.id, _action: action, _note: note });
    setProcessing(null);
    if (error) { toast.error(friendlySupabaseError(error)); return; }
    const res = data as any;
    if (!res?.success) { toast.error(friendlySupabaseError(res?.error ?? "处理失败")); return; }

    if (action === "approve" && res.channel && res.channel !== "wallet" && res.channel !== "mock") {
      const { error: e2 } = await supabase.functions.invoke("refund-payment", { body: { refund_id: r.id } });
      if (e2) toast.error("渠道退款调用失败：" + friendlySupabaseError(e2));
      else toast.success("已批准并已提交渠道退款");
    } else {
      toast.success(action === "approve" ? "已批准并退款到余额" : "已驳回");
    }
    setDetail(null);
    setPendingConfirm(null);
    await load();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14 max-w-3xl mx-auto">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-secondary" aria-label="返回">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-extrabold text-lg flex-1">退款审核</h1>
          <button onClick={load} className="p-2 rounded-full hover:bg-secondary" aria-label="刷新">
            <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
          </button>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
          {([
            { k: "pending", label: "待审核" },
            { k: "approved", label: "处理中" },
            { k: "all", label: "全部" },
          ] as const).map((t) => (
            <button
              key={t.k}
              onClick={() => setFilter(t.k)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap",
                filter === t.k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              )}
            >{t.label}</button>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        <PartialRefundCard onDone={load} />

        {loading ? (
          <div className="text-center py-12 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin inline" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">暂无相关退款</div>
        ) : (
          rows.map((r) => {
            const cMeta = CHANNEL_META[r.payments?.channel ?? ""] ?? CHANNEL_META.mock;
            const sMeta = STATUS_META[r.status] ?? { label: r.status, cls: "bg-muted text-muted-foreground" };
            return (
              <div key={r.id} className="bg-card rounded-2xl p-4 card-shadow space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {r.orders?.is_physical
                      ? <Package className="w-4 h-4 text-amber-600 shrink-0" />
                      : <Sparkles className="w-4 h-4 text-primary shrink-0" />}
                    <span className="font-semibold text-sm truncate">{r.orders?.order_no ?? r.order_id.slice(0, 8)}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">
                      {r.orders?.is_physical ? "实物" : "虚拟"}·{r.refund_type === "auto" ? "自动" : "人工"}
                    </span>
                  </div>
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full shrink-0", sMeta.cls)}>{sMeta.label}</span>
                </div>

                <div className="text-sm grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <cMeta.icon className={cn("w-3.5 h-3.5", cMeta.color)} /> {cMeta.label}
                  </div>
                  <div className="text-right">退款 <span className="font-bold text-primary">¥{Number(r.amount).toFixed(2)}</span></div>
                </div>
                {r.reason && <div className="text-xs text-muted-foreground line-clamp-2">「{r.reason}」</div>}
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("zh-CN")}</div>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setDetail(r)}>
                    <Eye className="w-4 h-4 mr-1" /> 查看详情
                  </Button>
                  {r.status === "pending" && (
                    <>
                      <Button
                        variant="hero" size="sm" className="flex-1"
                        disabled={processing === r.id}
                        onClick={() => requestHandle(r, "approve")}
                      >
                        {processing === r.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                        {r.payments?.channel === "wallet" || r.payments?.channel === "mock" ? "批准并退款" : "批准并提交渠道"}
                      </Button>
                      <Button
                        variant="outline" size="sm" className="flex-1"
                        disabled={processing === r.id}
                        onClick={() => requestHandle(r, "reject")}
                      >
                        <XCircle className="w-4 h-4 mr-1" />驳回
                      </Button>
                    </>
                  )}
                  {r.status === "approved" && r.payments?.channel !== "wallet" && (
                    <Button
                      variant="hero" size="sm" className="flex-1"
                      disabled={processing === r.id}
                      onClick={async () => {
                        setProcessing(r.id);
                        const { error } = await supabase.functions.invoke("refund-payment", { body: { refund_id: r.id } });
                        setProcessing(null);
                        if (error) toast.error(error.message);
                        else { toast.success("已重试渠道退款"); await load(); }
                      }}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" /> 重试渠道退款
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> 退款详情与操作日志
            </DialogTitle>
          </DialogHeader>
          {detail && (() => {
            const cMeta = CHANNEL_META[detail.payments?.channel ?? ""] ?? CHANNEL_META.mock;
            const sMeta = STATUS_META[detail.status] ?? { label: detail.status, cls: "bg-muted text-muted-foreground" };
            return (
              <div className="space-y-4 text-sm">
                {/* Order */}
                <section className="space-y-1.5">
                  <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                    {detail.orders?.is_physical ? <Package className="w-4 h-4 text-amber-600" /> : <Sparkles className="w-4 h-4 text-primary" />}
                    订单信息
                  </h4>
                  <KV k="订单号" v={<span className="font-mono">{detail.orders?.order_no ?? detail.order_id.slice(0, 8)}</span>} />
                  <KV k="订单类型" v={detail.orders?.is_physical ? "实物订单（需人工审核）" : "虚拟服务（服务商可处理）"} />
                  <KV k="订单金额" v={<span className="font-bold">¥{Number(detail.orders?.total_amount ?? 0).toFixed(2)}</span>} />
                  {detail.orders?.pickup_address && <KV k="上车地址" v={<span className="line-clamp-2">{detail.orders.pickup_address}</span>} />}
                  {detail.orders?.dropoff_address && <KV k="下车地址" v={<span className="line-clamp-2">{detail.orders.dropoff_address}</span>} />}
                  {detail.orders?.notes && <KV k="订单备注" v={detail.orders.notes} />}
                  <button
                    type="button"
                    onClick={() => { setDetail(null); navigate(`/order/${detail.order_id}`); }}
                    className="inline-flex items-center gap-1 text-primary text-xs font-medium hover:underline"
                  >
                    跳转订单详情 <ExternalLink className="w-3 h-3" />
                  </button>
                </section>

                {/* Payment */}
                <section className="space-y-1.5 pt-2 border-t border-border">
                  <h4 className="font-bold text-foreground text-sm">支付渠道</h4>
                  <KV k="支付方式" v={
                    <span className="inline-flex items-center gap-1.5">
                      <cMeta.icon className={cn("w-3.5 h-3.5", cMeta.color)} /> {cMeta.label}
                    </span>
                  } />
                  {detail.payments?.channel_txn_id && (
                    <KV k="渠道流水号" v={<span className="font-mono text-xs break-all">{detail.payments.channel_txn_id}</span>} />
                  )}
                  {detail.payments?.paid_at && (
                    <KV k="支付时间" v={new Date(detail.payments.paid_at).toLocaleString("zh-CN")} />
                  )}
                </section>

                {/* Refund */}
                <section className="space-y-1.5 pt-2 border-t border-border">
                  <h4 className="font-bold text-foreground text-sm">退款信息</h4>
                  <KV k="当前状态" v={<span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", sMeta.cls)}>{sMeta.label}</span>} />
                  <KV k="退款金额" v={<span className="font-bold text-primary">¥{Number(detail.amount).toFixed(2)}</span>} />
                  <KV k="退款类型" v={detail.refund_type === "auto" ? "虚拟订单·自动" : "实物订单·人工"} />
                  {detail.reason && <KV k="申请原因" v={<span className="line-clamp-3">{detail.reason}</span>} />}
                  {detail.channel_refund_id && (
                    <KV k="渠道退款号" v={<span className="font-mono text-xs break-all">{detail.channel_refund_id}</span>} />
                  )}
                </section>

                {/* Timeline */}
                <section className="pt-2 border-t border-border">
                  <h4 className="font-bold text-foreground text-sm mb-2">操作日志</h4>
                  <ol className="relative border-l-2 border-border ml-2 space-y-3 pl-4">
                    <TimelineItem
                      ts={detail.created_at}
                      title="用户提交退款申请"
                      desc={detail.reason ? `原因：${detail.reason}` : "—"}
                      tone="muted"
                    />
                    {detail.status !== "pending" && (
                      <TimelineItem
                        ts={detail.updated_at}
                        title={
                          detail.status === "rejected" ? "审核驳回"
                          : detail.status === "approved" ? "审核通过·已提交渠道"
                          : detail.status === "succeeded" ? "退款完成"
                          : detail.status === "failed" ? "渠道退款失败" : detail.status
                        }
                        desc={detail.operator_note ? `备注：${detail.operator_note}` : (detail.operator_id ? `操作人：${detail.operator_id.slice(0, 8)}` : "")}
                        tone={detail.status === "rejected" || detail.status === "failed" ? "danger" : detail.status === "succeeded" ? "success" : "info"}
                      />
                    )}
                    {detail.status === "approved" && (
                      <TimelineItem ts="" title="等待渠道异步回执…" desc="若长时间未回执可使用「重试渠道退款」" tone="muted" />
                    )}
                  </ol>
                </section>

                {/* Footer actions */}
                {detail.status === "pending" && (
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button variant="hero" className="flex-1" disabled={processing === detail.id} onClick={() => requestHandle(detail, "approve")}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> 批准退款
                    </Button>
                    <Button variant="outline" className="flex-1" disabled={processing === detail.id} onClick={() => requestHandle(detail, "reject")}>
                      <XCircle className="w-4 h-4 mr-1" /> 驳回
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AdminConfirmDialog
        open={!!pendingConfirm}
        onOpenChange={(o) => !o && setPendingConfirm(null)}
        actionLabel={pendingConfirm ? `${pendingConfirm.action === "approve" ? "批准退款" : "驳回退款"} · ¥${Number(pendingConfirm.r.amount).toFixed(2)}` : ""}
        description="该操作将真实触发退款或拒绝流程，请输入密码继续。"
        onConfirmed={executeHandle}
      />
    </div>
  );
};

const KV = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-muted-foreground shrink-0">{k}</span>
    <span className="text-foreground text-right break-all">{v}</span>
  </div>
);

const TimelineItem = ({ ts, title, desc, tone }: { ts: string; title: string; desc?: string; tone: "muted" | "info" | "success" | "danger" }) => (
  <li className="relative">
    <span className={cn(
      "absolute -left-[22px] top-1 w-3 h-3 rounded-full border-2 border-background",
      tone === "success" && "bg-green-500",
      tone === "danger" && "bg-red-500",
      tone === "info" && "bg-blue-500",
      tone === "muted" && "bg-muted-foreground/50",
    )} />
    <div className="text-xs text-muted-foreground">{ts ? new Date(ts).toLocaleString("zh-CN") : "—"}</div>
    <div className="text-sm font-semibold text-foreground">{title}</div>
    {desc && <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>}
  </li>
);

export default AdminRefundsPage;

function PartialRefundCard({ onDone }: { onDone: () => void }) {
  const [orderNo, setOrderNo] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!orderNo.trim() || !amount) { toast.error("请填写订单号和金额"); return; }
    const amt = Number(amount);
    if (!(amt > 0)) { toast.error("金额无效"); return; }
    setBusy(true);
    const { data: ord, error: e1 } = await supabase
      .from("orders").select("id").eq("order_no", orderNo.trim()).maybeSingle();
    if (e1 || !ord) { setBusy(false); toast.error("订单不存在"); return; }
    const { data, error } = await (supabase as any).rpc("partial_refund", {
      _order_id: ord.id, _amount: amt, _reason: reason || null,
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error("部分退款失败：" + (data?.error ?? error?.message ?? "未知错误"));
      return;
    }
    toast.success(`已部分退款 ¥${amt.toFixed(2)} · ${data.eta ?? ""}`);
    setOrderNo(""); setAmount(""); setReason("");
    onDone();
  };

  return (
    <section className="rounded-2xl border border-sky-300 bg-sky-50 p-4 space-y-2">
      <div className="font-bold text-sky-900 text-sm flex items-center gap-1">
        <RefreshCw className="w-4 h-4" /> 手动部分退款
      </div>
      <p className="text-xs text-sky-800/80">按订单号录入金额（小于订单总额），系统会按比例回滚担保金与闪购库存，并通知用户。</p>
      <div className="grid grid-cols-3 gap-2">
        <input value={orderNo} onChange={e => setOrderNo(e.target.value)} placeholder="订单号 ORDxxx"
          className="col-span-3 sm:col-span-1 px-3 h-9 rounded-lg border border-sky-300 bg-background text-sm" />
        <input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="退款金额 ¥"
          className="col-span-3 sm:col-span-1 px-3 h-9 rounded-lg border border-sky-300 bg-background text-sm" />
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="退款原因（可选）"
          className="col-span-3 sm:col-span-1 px-3 h-9 rounded-lg border border-sky-300 bg-background text-sm" />
      </div>
      <Button size="sm" onClick={submit} disabled={busy} className="bg-sky-600 hover:bg-sky-700 text-white">
        {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}发起部分退款
      </Button>
    </section>
  );
}
