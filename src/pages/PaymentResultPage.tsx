import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Status = "pending" | "succeeded" | "failed" | "closed" | "refunded";

const PaymentResultPage = () => {
  const { id: orderId } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<Status>("pending");
  const [paymentId, setPaymentId] = useState<string | null>(params.get("pid"));
  const [channel, setChannel] = useState<string>("");
  const [amount, setAmount] = useState<number>(0);
  const [polling, setPolling] = useState(true);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    if (!orderId) return;
    void loadLatest();
  }, [authLoading, user, orderId]);

  const loadLatest = async () => {
    const { data } = await supabase
      .from("payments").select("*")
      .eq("order_id", orderId!).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!data) { setPolling(false); return; }
    setPaymentId(data.id);
    setStatus(data.status as Status);
    setChannel(data.channel);
    setAmount(Number(data.amount));
    if (data.status !== "pending") setPolling(false);
  };

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
    timerRef.current = window.setInterval(tick, 3000) as unknown as number;
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [polling, paymentId]);

  // Realtime: react instantly to webhook updates
  useEffect(() => {
    if (!paymentId) return;
    const ch = supabase.channel(`payment:${paymentId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "payments", filter: `id=eq.${paymentId}` },
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

  const isMock = channel === "mock" || channel === "wechat" || channel === "alipay";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button onClick={() => navigate("/orders")} className="p-2 -ml-2 rounded-full hover:bg-secondary" aria-label="返回">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-extrabold text-lg">支付结果</h1>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-6 py-10 flex flex-col items-center text-center gap-4">
        {status === "pending" && (
          <>
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
            <h2 className="text-2xl font-extrabold">支付处理中…</h2>
            <p className="text-sm text-muted-foreground">
              {channel === "stripe" ? "请在新窗口完成 Stripe 支付，完成后自动返回" :
                isMock ? "当前为开发模式（模拟支付通道）" : "等待渠道回调"}
            </p>
            <p className="text-xs text-muted-foreground">渠道：{channel || "—"} · 金额 ¥{amount.toFixed(2)}</p>

            {isMock && (
              <div className="w-full mt-4 p-4 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/20 space-y-2">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">🔧 模拟收银台（开发模式）</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                  上线时只需在 Cloud Secrets 配置 {channel === "wechat" ? "WECHAT_*" : channel === "alipay" ? "ALIPAY_*" : "STRIPE_SECRET_KEY"}，本面板会自动消失。
                </p>
                <div className="flex gap-2 pt-1">
                  <Button variant="hero" className="flex-1" onClick={() => mockAction("succeed")}>模拟支付成功</Button>
                  <Button variant="outline" className="flex-1" onClick={() => mockAction("fail")}>模拟支付失败</Button>
                </div>
              </div>
            )}

            <Button variant="outline" onClick={manualCheck} className="mt-2">
              <RefreshCw className="w-4 h-4 mr-1" /> 我已完成支付，立即查询
            </Button>
          </>
        )}

        {status === "succeeded" && (
          <>
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-extrabold">支付成功</h2>
            <p className="text-sm text-muted-foreground">订单已确认，我们会尽快为您安排服务</p>
            <div className="flex gap-3 w-full mt-4">
              <Button variant="outline" className="flex-1" onClick={() => navigate(`/order/${orderId}`)}>查看订单</Button>
              <Button variant="hero" className="flex-1" onClick={() => navigate("/")}>返回首页</Button>
            </div>
          </>
        )}

        {(status === "failed" || status === "closed") && (
          <>
            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
              <XCircle className="w-12 h-12 text-red-600" />
            </div>
            <h2 className="text-2xl font-extrabold">{status === "closed" ? "支付已超时关闭" : "支付失败"}</h2>
            <p className="text-sm text-muted-foreground">您可以重新选择支付方式再试一次</p>
            <Button variant="hero" className="w-full mt-4" onClick={() => navigate(`/order/${orderId}`)}>返回订单详情</Button>
          </>
        )}
      </main>
    </div>
  );
};

export default PaymentResultPage;
