import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, CheckCircle2, CreditCard, Smartphone, Landmark, ShieldCheck, Loader2, Tag, ChevronRight, X, Heart, MapPin, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLovePoints } from "@/hooks/useLovePoints";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CartItem } from "@/hooks/useCart";

// 积分抵现规则: 100 积分 = ¥1，单笔订单最多抵 20%
const POINTS_PER_YUAN = 100;
const MAX_POINTS_RATIO = 0.2;

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
  cart_items?: CartItem[];
  pet_id?: string;
  pet_snapshot?: any;
  pickup_tier?: {
    id: string;
    label: string;
    desc?: string;
    price: number;
    priceLabel?: string;
    recommended?: boolean;
  };
}

interface Coupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_order_amount: number;
  max_discount: number | null;
}

const PAYMENT_METHODS = [
  {
    id: "wallet",
    label: "钱包余额",
    icon: Wallet,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "ring-primary",
  },
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
    id: "stripe",
    label: "信用卡 / Stripe",
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
  const { balance: pointsBalance, refresh: refreshPoints } = useLovePoints();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>("wallet");
  const [isPaying, setIsPaying] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  // Coupon state
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [showCouponPicker, setShowCouponPicker] = useState(false);

  // Love points redemption
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);

  // Shipping address (only for shop orders with physical items)
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null);

  const orderData = location.state as OrderData | null;
  const isShop = orderData?.order_type === "shop" && (orderData?.cart_items?.length ?? 0) > 0;


  useEffect(() => {
    if (!orderData) {
      navigate("/booking", { replace: true });
    }
  }, [orderData, navigate]);

  // Fetch available coupons
  useEffect(() => {
    const fetchCoupons = async () => {
      const { data } = await supabase.from("coupons").select("*");
      if (data) setCoupons(data as Coupon[]);
    };
    fetchCoupons();
  }, []);

  // Fetch wallet balance
  useEffect(() => {
    if (!user) return;
    supabase.from("user_wallets").select("balance").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setWalletBalance(Number(data?.balance ?? 0)));
  }, [user]);

  // 余额不足时自动切换到下一个可用方式
  useEffect(() => {
    if (selectedMethod === "wallet" && walletBalance < (orderData?.total_amount ?? 0)) {
      setSelectedMethod("wechat");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletBalance, orderData?.total_amount]);

  // Fetch shipping addresses for shop orders
  useEffect(() => {
    if (!isShop || !user) return;
    supabase
      .from("shipping_addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .then(({ data }) => {
        setAddresses(data ?? []);
        const def = (data ?? []).find((a: any) => a.is_default) ?? (data ?? [])[0];
        if (def) setSelectedAddrId(def.id);
      });
  }, [isShop, user]);

  const calcDiscount = (coupon: Coupon): number => {
    if (!orderData) return 0;
    if (orderData.total_amount < coupon.min_order_amount) return 0;
    if (coupon.discount_type === "fixed") return coupon.discount_value;
    const raw = (orderData.total_amount * coupon.discount_value) / 100;
    return coupon.max_discount ? Math.min(raw, coupon.max_discount) : raw;
  };

  const discountAmount = selectedCoupon ? calcDiscount(selectedCoupon) : 0;
  const afterCoupon = Math.max(0, (orderData?.total_amount ?? 0) - discountAmount);

  // 积分抵现: 100 积分 = ¥1，单笔订单最多抵 20%
  const maxPointsByOrder = Math.floor((orderData?.total_amount ?? 0) * MAX_POINTS_RATIO * POINTS_PER_YUAN);
  const maxPointsByAfterCoupon = Math.floor(afterCoupon * POINTS_PER_YUAN);
  const maxPointsAvailable = Math.max(0, Math.min(pointsBalance, maxPointsByOrder, maxPointsByAfterCoupon));
  const effectivePoints = usePoints ? Math.min(pointsToUse, maxPointsAvailable) : 0;
  const pointsDiscount = effectivePoints / POINTS_PER_YUAN;
  const finalAmount = Math.max(0, afterCoupon - pointsDiscount);

  // Auto-apply max points when toggled on
  useEffect(() => {
    if (usePoints) setPointsToUse(maxPointsAvailable);
    else setPointsToUse(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usePoints, maxPointsAvailable]);

  if (!orderData) return null;

  const applicableCoupons = coupons.filter((c) => orderData.total_amount >= c.min_order_amount);
  const inapplicableCoupons = coupons.filter((c) => orderData.total_amount < c.min_order_amount);

  const handlePay = async () => {
    if (!user) {
      toast({ title: "请先登录", description: "需要登录后才能提交订单", variant: "destructive" });
      navigate("/auth");
      return;
    }

    if (isShop && !selectedAddrId) {
      toast({ title: "请选择收货地址", variant: "destructive" });
      return;
    }

    if (selectedMethod === "wallet") {
      // 下单前实时复核余额，防止并发场景（多端同时支付）失败
      const { data: fresh } = await supabase.from("user_wallets").select("balance").eq("user_id", user.id).maybeSingle();
      const liveBal = Number(fresh?.balance ?? 0);
      setWalletBalance(liveBal);
      if (liveBal < finalAmount) {
        const gap = (finalAmount - liveBal).toFixed(2);
        toast({
          title: "钱包余额不足",
          description: `当前余额 ¥${liveBal.toFixed(2)}，差额 ¥${gap}。已为您切换到微信支付，或前往钱包充值后重试。`,
          variant: "destructive",
        });
        setSelectedMethod("wechat");
        return;
      }
    }

    setIsPaying(true);

    try {
      const isPhysical = isShop;
      const addrSnap = isShop && selectedAddrId ? addresses.find((a) => a.id === selectedAddrId) : null;
      const { data: orderRow, error } = await supabase.from("orders").insert({
        user_id: user.id,
        order_type: orderData.order_type,
        service_type: orderData.service_type ?? null,
        pet_type: orderData.pet_type ?? null,
        pet_id: orderData.pet_id ?? null,
        pet_snapshot: orderData.pet_snapshot ?? null,
        booking_date: orderData.booking_date ?? null,
        booking_time: orderData.booking_time ?? null,
        store_name: orderData.store_name ?? null,
        pickup_address: orderData.pickup_address ?? null,
        dropoff_address: orderData.dropoff_address ?? null,
        notes: orderData.notes ?? null,
        total_amount: finalAmount,
        payment_method: selectedMethod,
        payment_status: "pending",
        order_status: "created",
        is_physical: isPhysical,
        shipping_address_snapshot: addrSnap ?? null,
      } as any).select("id, order_no").single();

      if (error) throw error;

      // 写入订单明细
      if (orderRow && orderData.cart_items && orderData.cart_items.length > 0) {
        const productIds = orderData.cart_items.map((c) => c.id);
        const { data: prodRows } = await supabase
          .from("products").select("id, merchant_id, cover_image").in("id", productIds);
        const prodMap = new Map((prodRows || []).map((p: any) => [p.id, p]));
        const items = orderData.cart_items.map((c) => {
          const p = prodMap.get(c.id);
          return {
            order_id: orderRow.id,
            product_id: c.id,
            merchant_id: p?.merchant_id ?? null,
            product_name: c.name,
            unit_price: c.price,
            quantity: c.quantity,
            cover_image: p?.cover_image ?? null,
          };
        });
        const { error: itemsErr } = await supabase.from("order_items").insert(items);
        if (itemsErr) console.error("insert order_items failed", itemsErr);
      }

      // 扣减爱心积分（订单创建成功即扣，与支付状态独立）
      if (effectivePoints > 0 && orderRow) {
        const { data: spendRes } = await (supabase as any).rpc("spend_love_points", {
          _points: effectivePoints,
          _purpose: "exchange",
          _related_type: "order",
          _related_id: orderRow.id,
          _description: `订单 ${orderRow.order_no} 积分抵现 ¥${pointsDiscount.toFixed(2)}`,
        });
        if (spendRes?.success) await refreshPoints();
      }

      if (orderData.order_type === "shop") {
        localStorage.removeItem("pawcare_cart");
      }

      // 调用 create-payment 创建支付单
      const { data: payRes, error: payErr } = await supabase.functions.invoke("create-payment", {
        body: { order_id: orderRow!.id, channel: selectedMethod },
      });
      if (payErr) throw payErr;
      const r = payRes as any;
      if (r?.error) throw new Error(r.error);

      // Stripe → 跳转 Checkout 新窗口
      if (r.checkout_url) {
        window.open(r.checkout_url, "_blank");
      }
      // 统一进入支付结果页（轮询 + Realtime）
      navigate(`/payment/result/${orderRow!.id}?pid=${r.payment_id}`, { replace: true });
    } catch (err: any) {
      console.error(err);
      toast({ title: "支付发起失败", description: err?.message ?? "请稍后重试", variant: "destructive" });
    } finally {
      setIsPaying(false);
    }
  };

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
            {/* Cart items list */}
            {orderData.cart_items && orderData.cart_items.length > 0 ? (
              <>
                {orderData.cart_items.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span className="text-muted-foreground truncate max-w-[200px]">{item.name} ×{item.quantity}</span>
                    <span className="font-semibold text-foreground">¥{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">服务类型</span>
                  <span className="font-semibold text-foreground">{orderData.service_label || orderData.order_type}</span>
                </div>
                {orderData.pickup_tier && (
                  <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">接送方案</span>
                      {orderData.pickup_tier.recommended && (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          ⭐ 推荐
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-sm">{orderData.pickup_tier.label}</span>
                      <span className="font-semibold text-primary text-sm">
                        {orderData.pickup_tier.priceLabel || `¥${orderData.pickup_tier.price}`}
                      </span>
                    </div>
                    {orderData.pickup_tier.desc && (
                      <p className="text-xs text-muted-foreground">{orderData.pickup_tier.desc}</p>
                    )}
                  </div>
                )}
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
              </>
            )}
            <div className="border-t border-border pt-2.5 mt-2.5 flex justify-between items-center">
              <span className="text-muted-foreground">商品总额</span>
              <span className="font-bold text-foreground">¥{orderData.total_amount.toFixed(2)}</span>
            </div>
          </div>
        </section>

        {/* Shipping Address (shop only) */}
        {isShop && (
          <section className="bg-card rounded-2xl p-5 card-shadow">
            <h2 className="font-bold text-foreground mb-3 text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> 收货地址
            </h2>
            {addresses.length === 0 ? (
              <button
                type="button"
                onClick={() => navigate("/profile/addresses?pick=1")}
                className="w-full p-3 rounded-xl border border-dashed text-sm text-muted-foreground hover:bg-muted"
              >
                + 添加收货地址
              </button>
            ) : (
              <div className="space-y-2">
                <select
                  value={selectedAddrId ?? ""}
                  onChange={(e) => setSelectedAddrId(e.target.value)}
                  className="w-full p-3 rounded-xl bg-secondary text-sm"
                >
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.recipient} {a.phone} · {a.province}{a.city}{a.district}{a.detail}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => navigate("/profile/addresses")}
                  className="text-xs text-primary"
                >
                  管理地址簿 →
                </button>
              </div>
            )}
          </section>
        )}

        {/* Coupon Section */}
        <section className="bg-card rounded-2xl p-5 card-shadow">
          <h2 className="font-bold text-foreground mb-3 text-base flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" /> 优惠券
          </h2>
          <button
            type="button"
            onClick={() => setShowCouponPicker(true)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-secondary hover:bg-muted transition-colors min-h-[48px]"
          >
            {selectedCoupon ? (
              <div className="flex items-center gap-2">
                <span className="text-primary font-bold">-¥{discountAmount.toFixed(2)}</span>
                <span className="text-sm text-foreground">{selectedCoupon.name}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">
                {applicableCoupons.length > 0 ? `${applicableCoupons.length}张可用` : "暂无可用优惠券"}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </section>

        {/* Love Points Redemption */}
        <section className="bg-card rounded-2xl p-5 card-shadow">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-foreground text-base flex items-center gap-2">
              <Heart className="w-4 h-4 text-primary fill-primary" /> 爱心积分抵现
            </h2>
            <Switch
              checked={usePoints}
              onCheckedChange={setUsePoints}
              disabled={maxPointsAvailable <= 0}
              aria-label="使用积分抵现"
            />
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            当前余额 <span className="font-bold text-primary">{pointsBalance}</span> 积分 · 100 积分 = ¥1 · 单笔最多抵 20%
          </p>
          {maxPointsAvailable <= 0 ? (
            <p className="text-xs text-muted-foreground">
              {pointsBalance === 0 ? "暂无可用积分" : "本单不满足积分抵扣条件"}
            </p>
          ) : usePoints ? (
            <div className="space-y-2 pt-1">
              <Slider
                value={[Math.min(pointsToUse, maxPointsAvailable)]}
                min={0}
                max={maxPointsAvailable}
                step={10}
                onValueChange={(v) => setPointsToUse(v[0])}
              />
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">使用 <span className="font-bold text-foreground">{effectivePoints}</span> 积分</span>
                <span className="text-primary font-bold">抵扣 ¥{pointsDiscount.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              最多可用 <span className="font-bold text-primary">{maxPointsAvailable}</span> 积分，抵扣 ¥{(maxPointsAvailable / POINTS_PER_YUAN).toFixed(2)}
            </p>
          )}
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
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm text-foreground">{method.label}</div>
                  {method.id === "wallet" && (
                    <div className={cn("text-xs", walletBalance < finalAmount ? "text-destructive" : "text-muted-foreground")}>
                      余额 ¥{walletBalance.toFixed(2)}
                      {walletBalance < finalAmount && "（不足）"}
                    </div>
                  )}
                  {(method.id === "wechat" || method.id === "alipay") && (
                    <div className="text-xs text-muted-foreground">开发模式：模拟收银台</div>
                  )}
                </div>
                {selectedMethod === method.id && (
                  <CheckCircle2 className={cn("w-5 h-5", method.color)} />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Summary */}
        {(discountAmount > 0 || pointsDiscount > 0) && (
          <div className="bg-card rounded-2xl p-4 card-shadow space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">商品总额</span>
              <span className="text-foreground">¥{orderData.total_amount.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-primary">
                <span>优惠券抵扣</span>
                <span className="font-bold">-¥{discountAmount.toFixed(2)}</span>
              </div>
            )}
            {pointsDiscount > 0 && (
              <div className="flex justify-between text-primary">
                <span className="flex items-center gap-1"><Heart className="w-3 h-3 fill-primary" />积分抵扣 ({effectivePoints})</span>
                <span className="font-bold">-¥{pointsDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-border pt-2 flex justify-between items-center">
              <span className="font-bold text-foreground">实付金额</span>
              <span className="text-xl font-extrabold text-primary">¥{finalAmount.toFixed(2)}</span>
            </div>
          </div>
        )}

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
            `立即支付 ¥${finalAmount.toFixed(2)}`
          )}
        </Button>
      </main>

      {/* Coupon Picker Dialog */}
      <Dialog open={showCouponPicker} onOpenChange={setShowCouponPicker}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>选择优惠券</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {selectedCoupon && (
              <button
                type="button"
                onClick={() => { setSelectedCoupon(null); setShowCouponPicker(false); }}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" /> 不使用优惠券
              </button>
            )}

            {applicableCoupons.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">可用优惠券</p>
                <div className="space-y-2">
                  {applicableCoupons.map((coupon) => {
                    const discount = calcDiscount(coupon);
                    return (
                      <button
                        key={coupon.id}
                        type="button"
                        onClick={() => { setSelectedCoupon(coupon); setShowCouponPicker(false); }}
                        className={cn(
                          "w-full text-left p-4 rounded-xl border-2 transition-all",
                          selectedCoupon?.id === coupon.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-primary font-extrabold text-lg">
                            {coupon.discount_type === "fixed" ? `¥${coupon.discount_value}` : `${coupon.discount_value}%OFF`}
                          </span>
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                            省¥{discount.toFixed(2)}
                          </span>
                        </div>
                        <p className="font-semibold text-sm text-foreground">{coupon.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {coupon.description} · 满¥{coupon.min_order_amount}可用
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {inapplicableCoupons.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">暂不可用</p>
                <div className="space-y-2 opacity-50">
                  {inapplicableCoupons.map((coupon) => (
                    <div key={coupon.id} className="p-4 rounded-xl border border-border bg-muted/30">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground font-extrabold text-lg">
                          {coupon.discount_type === "fixed" ? `¥${coupon.discount_value}` : `${coupon.discount_value}%OFF`}
                        </span>
                      </div>
                      <p className="font-semibold text-sm text-muted-foreground">{coupon.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        满¥{coupon.min_order_amount}可用
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {coupons.length === 0 && (
              <p className="text-center text-muted-foreground py-8">暂无优惠券</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentPage;
