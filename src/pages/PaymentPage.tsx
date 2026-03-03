import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, CheckCircle2, CreditCard, Smartphone, Landmark, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface OrderData {
  order_type: string;
  service_type?: string;
  pet_type?: string;
  booking_date?: string;
  booking_time?: string;
  store_name?: string;
  pickup_address?: string;
  dropoff_address?: string;
  notes?: string;
  total_amount: number;
  service_label?: string;
  pet_label?: string;
}

const PAYMENT_METHODS = [
  {
    id: "wechat",
    label: "微信支付",
    icon: Smartphone,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    borderColor: "ring-green-500",
  },
  {
    id: "alipay",
    label: "支付宝",
    icon: Smartphone,
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "ring-blue-500",
  },
  {
    id: "bankcard",
    label: "银行卡支付",
    icon: CreditCard,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "ring-amber-500",
  },
] as const;

type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

const PaymentPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>("wechat");
  const [isPaying, setIsPaying] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  const orderData = location.state as OrderData | null;

  useEffect(() => {
    if (!orderData) {
      navigate("/booking", { replace: true });
    }
  }, [orderData, navigate]);

  if (!orderData) return null;

  const handlePay = async () => {
    if (!user) {
      toast({ title: "请先登录", description: "需要登录后才能提交订单", variant: "destructive" });
      navigate("/auth");
      return;
    }

    setIsPaying(true);

    try {
      // Create the order
      const { error } = await supabase.from("orders").insert({
        user_id: user.id,
        order_type: orderData.order_type,
        service_type: orderData.service_type ?? null,
        pet_type: orderData.pet_type ?? null,
        booking_date: orderData.booking_date ?? null,
        booking_time: orderData.booking_time ?? null,
        store_name: orderData.store_name ?? null,
        pickup_address: orderData.pickup_address ?? null,
        dropoff_address: orderData.dropoff_address ?? null,
        notes: orderData.notes ?? null,
        total_amount: orderData.total_amount,
        payment_method: selectedMethod,
        payment_status: "paid",
        order_status: "confirmed",
      });

      if (error) throw error;

      // Simulate payment processing
      await new Promise((r) => setTimeout(r, 1500));
      setPaySuccess(true);
    } catch (err) {
      console.error(err);
      toast({ title: "订单创建失败", description: "请稍后重试", variant: "destructive" });
    } finally {
      setIsPaying(false);
    }
  };

  if (paySuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 animate-fade-in-up">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">支付成功</h1>
          <p className="text-muted-foreground text-sm text-center">
            您的预约订单已确认，我们会尽快为您安排服务
          </p>
          <div className="flex gap-3 mt-6 w-full">
            <Button variant="outline" className="flex-1" onClick={() => navigate("/profile")}>
              查看订单
            </Button>
            <Button variant="hero" className="flex-1" onClick={() => navigate("/")}>
              返回首页
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="返回"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-extrabold text-lg text-foreground">确认订单</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pt-5 space-y-5">
        {/* Order Summary */}
        <section className="bg-card rounded-2xl p-5 card-shadow">
          <h2 className="font-bold text-foreground mb-3 text-base">订单详情</h2>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">服务类型</span>
              <span className="font-semibold text-foreground">{orderData.service_label || orderData.order_type}</span>
            </div>
            {orderData.pet_label && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">宠物类型</span>
                <span className="font-semibold text-foreground">{orderData.pet_label}</span>
              </div>
            )}
            {orderData.booking_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">预约日期</span>
                <span className="font-semibold text-foreground">{orderData.booking_date}</span>
              </div>
            )}
            {orderData.booking_time && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">预约时段</span>
                <span className="font-semibold text-foreground">{orderData.booking_time}</span>
              </div>
            )}
            {orderData.store_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">门店</span>
                <span className="font-semibold text-foreground">{orderData.store_name}</span>
              </div>
            )}
            {orderData.pickup_address && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">接宠地址</span>
                <span className="font-semibold text-foreground truncate max-w-[180px]">{orderData.pickup_address}</span>
              </div>
            )}
            {orderData.notes && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">备注</span>
                <span className="font-medium text-foreground truncate max-w-[180px]">{orderData.notes}</span>
              </div>
            )}
            <div className="border-t border-border pt-2.5 mt-2.5 flex justify-between items-center">
              <span className="font-bold text-foreground">应付金额</span>
              <span className="text-xl font-extrabold text-primary">¥{orderData.total_amount.toFixed(2)}</span>
            </div>
          </div>
        </section>

        {/* Payment Method */}
        <section className="bg-card rounded-2xl p-5 card-shadow">
          <h2 className="font-bold text-foreground mb-3 text-base flex items-center gap-2">
            <Landmark className="w-4 h-4 text-primary" /> 选择支付方式
          </h2>
          <div className="space-y-2.5" role="radiogroup" aria-label="支付方式">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.id}
                type="button"
                role="radio"
                aria-checked={selectedMethod === method.id}
                onClick={() => setSelectedMethod(method.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl transition-all min-h-[56px]",
                  selectedMethod === method.id
                    ? `${method.bgColor} ring-2 ${method.borderColor} ring-offset-2 ring-offset-background`
                    : "bg-secondary hover:bg-muted"
                )}
              >
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", method.bgColor)}>
                  <method.icon className={cn("w-5 h-5", method.color)} />
                </div>
                <span className="font-semibold text-sm text-foreground">{method.label}</span>
                {selectedMethod === method.id && (
                  <CheckCircle2 className={cn("w-5 h-5 ml-auto", method.color)} />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Security Note */}
        <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
          <span>您的支付信息受到加密保护，交易安全有保障</span>
        </div>

        {/* Pay Button */}
        <Button
          variant="hero"
          size="xl"
          className="w-full"
          onClick={handlePay}
          disabled={isPaying}
        >
          {isPaying ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> 支付处理中...
            </>
          ) : (
            `立即支付 ¥${orderData.total_amount.toFixed(2)}`
          )}
        </Button>
      </main>
    </div>
  );
};

export default PaymentPage;
