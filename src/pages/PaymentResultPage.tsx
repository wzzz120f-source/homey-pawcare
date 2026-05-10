import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, RefreshCw, Clock, Home,
  Receipt, MessageCircle, AlertCircle, Wallet, CreditCard, Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Status = "pending" | "succeeded" | "failed" | "closed" | "refunded";

const POLL_TIMEOUT_SEC = 15 * 60; // 15 min hard timeout for UI countdown
const POLL_INTERVAL_MS = 3000;

const CHANNEL_META: Record<string, { label: string; icon: typeof Wallet; color: string }> = {
  wallet: { label: "钱包余额", icon: Wallet, color: "text-primary" },
  stripe: { label: "Stripe / 信用卡", icon: CreditCard, color: "text-amber-600" },
  wechat: { label: "微信支付", icon: Smartphone, color: "text-green-600" },
  alipay: { label: "支付宝", icon: Smartphone, color: "text-blue-500" },
  mock: { label: "模拟通道", icon: Wallet, color: "text-muted-foreground" },
};

const PaymentResultPage = () => {
  const { id: orderId } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [status, setStatus] = useState<Status>("pending");
  const [paymentId, setPaymentId] = useState<string | null>(params.get("pid"));
  const [channel, setChannel] = useState<string>("");
  const [amount, setAmount] = useState<number>(0);
  const [orderNo, setOrderNo] = useState<string>("");
  const [createdAt, setCreatedAt] = useState<string>("");
  const [polling, setPolling] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(POLL_TIMEOUT_SEC);
  const tickRef = useRef<number | null>(null);
  const cdRef = useRef<number | null>(null);

  // Initial load
  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    if (!orderId) return;
    void loadLatest();
  }, [authLoading, user, orderId]);

  const loadLatest = async () => {
    const [pRes, oRes] = await Promise.all([
      supabase.from("payments").select("*")
        .eq("order_id", orderId!).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("orders").select("order_no, created_at, total_amount, payment_status")
        .eq("id", orderId!).maybeSingle(),
    ]);
    if (oRes.data) {
      setOrderNo(oRes.data.order_no);
      setCreatedAt(oRes.data.created_at);
    }
    if (pRes.data) {
      setPaymentId(pRes.data.id);
      setStatus(pRes.data.status as Status);
      setChannel(pRes.data.channel);
      setAmount(Number(pRes.data.amount));
      if (pRes.data.status !== "pending") setPolling(false);
    } else {
      setPolling(false);
    }
  };

  // Poll loop
  useEffect(() => {
    if (!polling || !paymentId) return;
    const tick = async () => {
      const { data } = await supabase.functions.invoke("query-payment", { body: { payment_id: paymentId } });
      const s = (data as any)?.status as Status | undefined;
      if (s) {
        setStatus(s);
        if (s !== "pending") setPolling(false);
      }
    };
    tickRef.current = window.setInterval(tick, POLL_INTERVAL_MS) as unknown as number;
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, [polling, paymentId]);

  // Countdown
  useEffect(() => {
    if (!polling) { if (cdRef.current) window.clearInterval(cdRef.current); return; }
    cdRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { setPolling(false); setStatus("closed"); return 0; }
        return s - 1;
      });
    }, 1000) as unknown as number;
    return () => { if (cdRef.current) window.clearInterval(cdRef.current); };
  }, [polling]);

  // Realtime
  useEffect(() => {
    if (!paymentId) return;
    const ch = supabase.channel(`payment:${paymentId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "payments", filter: `id=eq.${paymentId}` },
        (p) => {
          const s = (p.new as any).status as Status;
          setStatus(s);
          if (s !== "pending") setPolling(false);
        })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [paymentId]);

  const mockAction = async (act: "succeed" | "fail") => {
    if (!paymentId) return;
    const { data, error } = await supabase.functions.invoke("query-payment", { body: { payment_id: paymentId, action: act } });
    if (error) { toast.error(error.message); return; }
    const s = (data as any)?.status as Status;
    if (s) setStatus(s);
  };

  const manualCheck = async () => {
    if (!paymentId) { await loadLatest(); return; }
    const { data } = await supabase.functions.invoke("query-payment", { body: { payment_id: paymentId } });
    const s = (data as any)?.status as Status | undefined;
    if (s) setStatus(s);
  };

  const meta = useMemo(() => CHANNEL_META[channel] ?? CHANNEL_META.mock, [channel]);
  const isMockable = channel === "mock" || channel === "wechat" || channel === "alipay";

  const mmss = useMemo(() => {
    const m = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
    const s = (secondsLeft % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [secondsLeft]);

  const statusBadge = () => {
    const map = {
      pending: { label: "处理中", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
      succeeded: { label: "支付成功", cls: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300" },
      failed: { label: "支付失败", cls: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
      closed: { label: "已超时关闭", cls: "bg-muted text-muted-foreground" },
      refunded: { label: "已退款", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
    } as const;
    const m = map[status];
    return <span className={cn("text-xs font-semibold px-3 py-1 rounded-full", m.cls)}>{m.label}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button onClick={() => navigate("/orders")} className="p-2 -ml-2 rounded-full hover:bg-secondary" aria-label="返回">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-extrabold text-lg">支付结果</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-6 space-y-5">
        {/* Hero status card */}
        <section className={cn(
          "rounded-2xl p-6 card-shadow flex flex-col items-center text-center gap-3",
          status === "succeeded" && "bg-gradient-to-br from-green-50 to-card dark:from-green-950/30",
          status === "failed" && "bg-gradient-to-br from-red-50 to-card dark:from-red-950/30",
          status === "closed" && "bg-gradient-to-br from-muted/40 to-card",
          status === "pending" && "bg-gradient-to-br from-primary/10 to-card",
          status === "refunded" && "bg-gradient-to-br from-blue-50 to-card dark:from-blue-950/30",
        )}>
          {status === "pending" && (
            <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
            </div>
          )}
          {status === "succeeded" && (
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
          )}
          {(status === "failed" || status === "closed") && (
            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
              {status === "closed" ? <Clock className="w-12 h-12 text-amber-600" /> : <XCircle className="w-12 h-12 text-red-600" />}
            </div>
          )}
          {status === "refunded" && (
            <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <RefreshCw className="w-12 h-12 text-blue-600" />
            </div>
          )}

          <h2 className="text-2xl font-extrabold text-foreground">
            {status === "pending" && "支付处理中…"}
            {status === "succeeded" && "支付成功"}
            {status === "failed" && "支付失败"}
            {status === "closed" && "支付已超时"}
            {status === "refunded" && "已退款"}
          </h2>

          <p className="text-sm text-muted-foreground max-w-xs">
            {status === "pending" && (channel === "stripe" ? "请在新窗口完成 Stripe 支付，完成后页面会自动刷新。" : isMockable ? "当前为开发模式（模拟通道），可点击下方按钮模拟结果。" : "正在等待支付渠道回调…")}
            {status === "succeeded" && "您的订单已确认，我们会尽快为您安排服务。"}
            {status === "failed" && "支付未完成，您可以返回订单详情重新发起支付。"}
            {status === "closed" && "本次支付单已超时关闭，请重新发起支付。"}
            {status === "refunded" && "退款已到账，可在钱包流水中查看。"}
          </p>

          {status === "pending" && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              剩余等待 <span className="font-bold text-foreground tabular-nums">{mmss}</span>
            </div>
          )}
        </section>

        {/* Order summary */}
        <section className="bg-card rounded-2xl p-5 card-shadow space-y-2.5 text-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground text-base">订单详情</h3>
            {statusBadge()}
          </div>
          <Row k="订单号" v={orderNo || orderId?.slice(0, 8) || "—"} mono />
          <Row k="支付渠道" v={
            <span className="inline-flex items-center gap-1.5">
              <meta.icon className={cn("w-3.5 h-3.5", meta.color)} />
              {meta.label}
            </span>
          } />
          <Row k="支付金额" v={<span className="font-bold text-primary text-base">¥{amount.toFixed(2)}</span>} />
          {createdAt && <Row k="创建时间" v={new Date(createdAt).toLocaleString("zh-CN")} />}
        </section>

        {/* Mock dev console */}
        {status === "pending" && isMockable && (
          <section className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <AlertCircle className="w-4 h-4" /> 模拟收银台（开发模式）
            </div>
            <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
              上线时只需在 Cloud Secrets 配置 {channel === "wechat" ? "WECHAT_*" : channel === "alipay" ? "ALIPAY_*" : "STRIPE_SECRET_KEY"}，本面板会自动消失。
            </p>
            <div className="flex gap-2 pt-1">
              <Button variant="hero" className="flex-1" onClick={() => mockAction("succeed")}>模拟成功</Button>
              <Button variant="outline" className="flex-1" onClick={() => mockAction("fail")}>模拟失败</Button>
            </div>
          </section>
        )}

        {/* Action buttons */}
        <section className="space-y-2">
          {status === "pending" && (
            <Button variant="outline" className="w-full" onClick={manualCheck}>
              <RefreshCw className="w-4 h-4 mr-1" /> 我已完成支付，立即查询
            </Button>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              <Home className="w-4 h-4 mr-1" /> 首页
            </Button>
            <Button variant="outline" onClick={() => navigate(`/order/${orderId}`)}>
              <Receipt className="w-4 h-4 mr-1" /> 订单
            </Button>
            <Button variant="outline" onClick={() => navigate("/customer-service")}>
              <MessageCircle className="w-4 h-4 mr-1" /> 客服
            </Button>
          </div>
          {(status === "failed" || status === "closed") && (
            <Button variant="hero" className="w-full" onClick={() => navigate(`/order/${orderId}`)}>
              重新发起支付
            </Button>
          )}
          {status === "succeeded" && (
            <Button variant="hero" className="w-full" onClick={() => navigate(`/order/${orderId}`)}>
              查看订单详情
            </Button>
          )}
        </section>
      </main>
    </div>
  );
};

const Row = ({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-muted-foreground">{k}</span>
    <span className={cn("text-foreground text-right", mono && "font-mono text-xs")}>{v}</span>
  </div>
);

export default PaymentResultPage;
