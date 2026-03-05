import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, Truck, CheckCircle2, Clock, MapPin, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Order {
  id: string;
  order_no: string;
  order_type: string;
  service_type: string | null;
  pet_type: string | null;
  total_amount: number;
  payment_status: string;
  order_status: string;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
  booking_date: string | null;
  booking_time: string | null;
  store_name: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  notes: string | null;
}

const STATUS_STEPS = [
  { key: "created", label: "订单创建", icon: Package },
  { key: "confirmed", label: "已确认", icon: CheckCircle2 },
  { key: "in_progress", label: "服务中", icon: Truck },
  { key: "completed", label: "已完成", icon: CheckCircle2 },
];

const PAYMENT_LABEL: Record<string, string> = {
  wechat: "微信支付",
  alipay: "支付宝",
  bankcard: "银行卡支付",
};

const LOGISTICS_MOCK = [
  { time: "2026-03-05 14:30", text: "服务已完成，感谢您的使用 🎉" },
  { time: "2026-03-05 10:00", text: "技师已到达，服务进行中" },
  { time: "2026-03-05 09:30", text: "技师正在前往您的位置" },
  { time: "2026-03-04 16:00", text: "订单已确认，已为您分配技师" },
  { time: "2026-03-04 15:30", text: "订单创建成功，等待确认" },
];

const OrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user || !id) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
      if (data) setOrder(data as Order);
      setLoading(false);
    };
    fetch();
  }, [user, id]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">订单不存在</p>
        <Button variant="outline" onClick={() => navigate("/profile")}>返回</Button>
      </div>
    );
  }

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === order.order_status);
  const activeStep = currentStepIndex === -1 ? 0 : currentStepIndex;

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-extrabold text-lg text-foreground">订单详情</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {/* Status Progress */}
        <section className="bg-card rounded-2xl p-5 card-shadow">
          <div className="flex items-center justify-between mb-4">
            {STATUS_STEPS.map((step, i) => {
              const isActive = i <= activeStep;
              const StepIcon = step.icon;
              return (
                <div key={step.key} className="flex flex-col items-center flex-1 relative">
                  {i > 0 && (
                    <div
                      className={cn(
                        "absolute top-4 right-1/2 w-full h-0.5 -z-10",
                        i <= activeStep ? "bg-primary" : "bg-border"
                      )}
                    />
                  )}
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center z-10",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <StepIcon className="w-4 h-4" />
                  </div>
                  <span className={cn("text-[10px] mt-1.5 text-center", isActive ? "text-foreground font-semibold" : "text-muted-foreground")}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Order Info */}
        <section className="bg-card rounded-2xl p-5 card-shadow space-y-3">
          <h2 className="font-bold text-foreground text-base">订单信息</h2>
          <InfoRow label="订单编号" value={order.order_no} mono />
          <InfoRow label="订单类型" value={order.service_type || order.order_type} />
          {order.pet_type && <InfoRow label="宠物类型" value={order.pet_type} />}
          {order.booking_date && <InfoRow label="预约日期" value={`${order.booking_date} ${order.booking_time || ""}`} />}
          {order.store_name && <InfoRow label="门店" value={order.store_name} />}
          <InfoRow label="创建时间" value={format(new Date(order.created_at), "yyyy-MM-dd HH:mm:ss")} />
        </section>

        {/* Address */}
        {(order.pickup_address || order.dropoff_address) && (
          <section className="bg-card rounded-2xl p-5 card-shadow space-y-3">
            <h2 className="font-bold text-foreground text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> 地址信息
            </h2>
            {order.pickup_address && <InfoRow label="接宠地址" value={order.pickup_address} />}
            {order.dropoff_address && <InfoRow label="送回地址" value={order.dropoff_address} />}
          </section>
        )}

        {/* Payment */}
        <section className="bg-card rounded-2xl p-5 card-shadow space-y-3">
          <h2 className="font-bold text-foreground text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" /> 支付信息
          </h2>
          <InfoRow label="支付方式" value={PAYMENT_LABEL[order.payment_method || ""] || "未支付"} />
          <InfoRow label="支付状态" value={order.payment_status === "paid" ? "已支付" : "待支付"} />
          <div className="flex justify-between items-center pt-2 border-t border-border/50">
            <span className="text-sm text-muted-foreground">订单金额</span>
            <span className="text-xl font-extrabold text-primary">¥{Number(order.total_amount).toFixed(2)}</span>
          </div>
        </section>

        {/* Notes */}
        {order.notes && (
          <section className="bg-card rounded-2xl p-5 card-shadow">
            <h2 className="font-bold text-foreground text-base mb-2">备注</h2>
            <p className="text-sm text-muted-foreground">{order.notes}</p>
          </section>
        )}

        {/* Logistics Timeline */}
        <section className="bg-card rounded-2xl p-5 card-shadow">
          <h2 className="font-bold text-foreground text-base flex items-center gap-2 mb-4">
            <Truck className="w-4 h-4 text-primary" /> 服务进度
          </h2>
          <div className="space-y-0">
            {LOGISTICS_MOCK.map((item, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full shrink-0 mt-1.5",
                    i === 0 ? "bg-primary" : "bg-border"
                  )} />
                  {i < LOGISTICS_MOCK.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
                </div>
                <div className="pb-4">
                  <p className={cn("text-sm", i === 0 ? "text-foreground font-semibold" : "text-muted-foreground")}>{item.text}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate("/customer-service")}>
            联系客服
          </Button>
          <Button variant="hero" className="flex-1" onClick={() => navigate("/profile")}>
            返回订单列表
          </Button>
        </div>
      </main>
    </div>
  );
};

const InfoRow = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex justify-between items-center text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className={cn("text-foreground font-medium", mono && "font-mono text-xs")}>{value}</span>
  </div>
);

export default OrderDetailPage;
