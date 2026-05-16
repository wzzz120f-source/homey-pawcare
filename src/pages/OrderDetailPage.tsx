import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Package, Truck, CheckCircle2, MapPin, CreditCard, Star, MessageSquare, AlertTriangle, XCircle } from "lucide-react";
import MediaPicker from "@/components/MediaPicker";
import MediaThumb from "@/components/MediaThumb";
import CompanionReportGenerator, { type SavedReport } from "@/components/CompanionReportGenerator";
import EscrowStatusCard from "@/components/EscrowStatusCard";
import ServiceProgressTimeline from "@/components/ServiceProgressTimeline";
import { type PreparedMedia, uploadPreparedMedia, revokePreviews } from "@/lib/mediaUpload";
import { cn } from "@/lib/utils";
import { format, addHours, addMinutes } from "date-fns";
import { toast } from "sonner";

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
  escrow_status?: string | null;
  user_id?: string;
  provider_id?: string | null;
  driver_id?: string | null;
}

interface Review {
  id: string;
  rating: number;
  content: string;
  created_at: string;
  media?: { id: string; media_url: string; media_type: string }[];
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

// Generate dynamic logistics based on order status and timestamps
const generateLogistics = (order: Order) => {
  const created = new Date(order.created_at);
  const updated = new Date(order.updated_at);
  const steps: { time: string; text: string }[] = [];

  // Always show creation
  steps.push({ time: format(created, "yyyy-MM-dd HH:mm"), text: "订单创建成功，等待确认 📋" });

  const statusOrder = ["created", "confirmed", "in_progress", "completed"];
  const currentIdx = statusOrder.indexOf(order.order_status);

  if (currentIdx >= 1) {
    const t = addMinutes(created, 15 + Math.floor(Math.random() * 30));
    steps.push({ time: format(t, "yyyy-MM-dd HH:mm"), text: "订单已确认，已为您分配专属技师 ✅" });
  }
  if (currentIdx >= 2) {
    const t = addHours(created, 1 + Math.floor(Math.random() * 2));
    steps.push({ time: format(t, "yyyy-MM-dd HH:mm"), text: "技师正在前往您的位置 🚗" });
    const t2 = addMinutes(t, 20);
    steps.push({ time: format(t2, "yyyy-MM-dd HH:mm"), text: "技师已到达，服务进行中 🐾" });
  }
  if (currentIdx >= 3) {
    steps.push({ time: format(updated, "yyyy-MM-dd HH:mm"), text: "服务已完成，感谢您的使用 🎉" });
  }

  return steps.reverse(); // newest first
};

const OrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<Review | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [media, setMedia] = useState<PreparedMedia[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [savedReport, setSavedReport] = useState<SavedReport | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const refetch = async () => {
    if (!user || !id) return;
    const { data } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
    if (data) setOrder(data as Order);
  };

  useEffect(() => {
    if (!user || !id) return;
    const fetchData = async () => {
      const [orderRes, reviewRes] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).maybeSingle(),
        supabase.from("order_reviews" as any).select("*, media:review_media(id, media_url, media_type)").eq("order_id", id).eq("user_id", user.id).maybeSingle(),
      ]);
      if (orderRes.data) setOrder(orderRes.data as Order);
      if (reviewRes.data) setReview(reviewRes.data as any);
      setLoading(false);
    };
    fetchData();
  }, [user, id]);

  const handleSubmitReview = async () => {
    if (!user || !order) return;
    setSubmittingReview(true);
    try {
      const { data, error } = await supabase.from("order_reviews" as any).insert({
        order_id: order.id,
        user_id: user.id,
        rating: reviewRating,
        content: reviewContent.trim(),
      } as any).select().single();
      if (error) throw error;

      // Upload media (images / videos / Live Photo pairs)
      const mediaResults: { id: string; media_url: string; media_type: string }[] = [];
      for (const item of media) {
        try {
          const { url, mediaType } = await uploadPreparedMedia(
            supabase,
            "review-media",
            user.id,
            item,
            (data as any).id
          );
          const { data: mediaRow } = await (supabase.from("review_media") as any)
            .insert({
              review_id: (data as any).id,
              media_url: url,
              media_type: mediaType,
            })
            .select()
            .single();
          if (mediaRow) mediaResults.push(mediaRow as any);
        } catch (e) {
          console.warn("评价媒体上传失败", e);
        }
      }

      setReview({ ...(data as any), media: mediaResults });
      setShowReviewForm(false);
      revokePreviews(media);
      setMedia([]);
      // 评价完成 → 发放爱心积分（失败不阻断）
      supabase.functions.invoke("award-love-points", {
        body: { action: "order_review", related_type: "order", related_id: order.id, description: "完成订单评价" },
      }).then(({ data: ap }: any) => {
        if (ap?.ok && ap?.granted) toast.success(`评价提交成功！+${ap.granted} 爱心积分`);
        else toast.success("评价提交成功！");
      }).catch(() => toast.success("评价提交成功！"));
    } catch (err: any) {
      toast.error(err.message || "提交失败");
    } finally {
      setSubmittingReview(false);
    }
  };

  const canCancel = order && ["created", "confirmed"].includes(order.order_status);

  const handleCancelOrder = async () => {
    if (!user || !order) return;
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-order", {
        body: { order_id: order.id, reason: "用户主动取消" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const refund = (data as any)?.refund;
      setOrder({
        ...order,
        order_status: "cancelled",
        ...(refund?.type === "auto" ? { payment_status: "refunded" } : {}),
      });
      setShowCancelConfirm(false);
      if (refund?.ok) {
        toast.success(refund.type === "auto"
          ? `订单已取消，¥${refund.amount.toFixed(2)} 将原路退回`
          : `订单已取消，¥${refund.amount.toFixed(2)} 退款待商家审核`);
      } else {
        toast.success("订单已取消");
      }
    } catch (err: any) {
      toast.error(err?.message || "取消失败");
    } finally {
      setCancelling(false);
    }
  };

  if (loading || authLoading) {
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
  const logistics = generateLogistics(order);
  const isOwner = order.user_id === user?.id;
  const isProvider = (order.provider_id ?? order.driver_id) === user?.id;
  const isServiceOrder = (order.order_type ?? "") === "service" || !!order.service_type;

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-extrabold text-lg text-foreground">订单详情</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {/* Unified service progress timeline (covers full lifecycle + actions) */}
        {isServiceOrder ? (
          <ServiceProgressTimeline
            orderId={order.id}
            status={order.order_status}
            isOwner={isOwner}
            isProvider={isProvider}
            onChanged={refetch}
          />
        ) : (
          <section className="bg-card rounded-2xl p-5 card-shadow">
            <div className="flex items-center justify-between mb-4">
              {STATUS_STEPS.map((step, i) => {
                const isActive = i <= activeStep;
                const StepIcon = step.icon;
                return (
                  <div key={step.key} className="flex flex-col items-center flex-1 relative">
                    {i > 0 && (
                      <div className={cn("absolute top-4 right-1/2 w-full h-0.5 -z-10", i <= activeStep ? "bg-primary" : "bg-border")} />
                    )}
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center z-10", isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      <StepIcon className="w-4 h-4" />
                    </div>
                    <span className={cn("text-[10px] mt-1.5 text-center", isActive ? "text-foreground font-semibold" : "text-muted-foreground")}>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

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
            {logistics.map((item, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={cn("w-2.5 h-2.5 rounded-full shrink-0 mt-1.5", i === 0 ? "bg-primary" : "bg-border")} />
                  {i < logistics.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
                </div>
                <div className="pb-4">
                  <p className={cn("text-sm", i === 0 ? "text-foreground font-semibold" : "text-muted-foreground")}>{item.text}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Review Section */}
        <section className="bg-card rounded-2xl p-5 card-shadow">
          <h2 className="font-bold text-foreground text-base flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-primary" /> 订单评价
          </h2>
          {review ? (
            <div>
              <div className="flex items-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={cn("w-5 h-5", s <= review.rating ? "text-amber-400 fill-amber-400" : "text-border")} />
                ))}
                <span className="text-xs text-muted-foreground ml-2">{format(new Date(review.created_at), "yyyy-MM-dd")}</span>
              </div>
              {review.content && <p className="text-sm text-foreground mb-2">{review.content}</p>}
              {review.media && review.media.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {review.media
                    .filter((m) => m.media_type !== "live_photo_video")
                    .map((m) => (
                      <MediaThumb
                        key={m.id}
                        url={m.media_url}
                        mediaType={m.media_type}
                        alt="评价媒体"
                        className="w-20 h-20 rounded-lg"
                      />
                    ))}
                </div>
              )}
            </div>
          ) : order.order_status === "completed" || order.payment_status === "paid" ? (
            showReviewForm ? (
              <div className="space-y-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} type="button" onClick={() => setReviewRating(s)} className="p-0.5">
                      <Star className={cn("w-7 h-7 transition-colors", s <= reviewRating ? "text-amber-400 fill-amber-400" : "text-border hover:text-amber-300")} />
                    </button>
                  ))}
                  <span className="text-sm text-muted-foreground ml-2">{reviewRating}分</span>
                </div>
                <Textarea
                  value={reviewContent}
                  onChange={(e) => setReviewContent(e.target.value)}
                  placeholder="分享您的服务体验..."
                  rows={3}
                  maxLength={500}
                />
                <MediaPicker value={media} onChange={setMedia} maxItems={9} />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowReviewForm(false)}>取消</Button>
                  <Button variant="hero" size="sm" className="flex-1" onClick={handleSubmitReview} disabled={submittingReview}>
                    {submittingReview ? "提交中..." : "提交评价"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="warm" size="sm" onClick={() => setShowReviewForm(true)} className="w-full">
                <Star className="w-4 h-4 mr-1" /> 写评价
              </Button>
            )
          ) : (
            <p className="text-sm text-muted-foreground">订单完成后可评价</p>
          )}
        </section>

        {/* AI 陪伴报告（服务完成后展示） */}
        {order.order_status === "completed" && (
          <section className="bg-card rounded-2xl p-5 card-shadow">
            <h2 className="font-bold text-foreground text-base flex items-center gap-2 mb-3">
              ✨ 今日陪伴报告
            </h2>

            {/* 历史记录摘要 */}
            {savedReport && (
              <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">📚 已保存的历史报告</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    更新于 {format(new Date(savedReport.updated_at), "yyyy-MM-dd HH:mm")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>勾选 {savedReport.actions?.length || 0} 项</span>
                  <span>·</span>
                  <span>{savedReport.photo_url ? "📷 含照片" : "无照片"}</span>
                  <span>·</span>
                  <span>{savedReport.diary ? "📔 已生成日记" : "未生成日记"}</span>
                  <span>·</span>
                  <span>{savedReport.poster_url ? "🖼️ 已存海报" : "无海报"}</span>
                </div>
                {savedReport.poster_url && (
                  <a
                    href={savedReport.poster_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-[11px] text-primary underline"
                  >
                    查看历史海报 →
                  </a>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground mb-3">
              勾选今日服务事项 + 上传照片，AI 将为您生成温馨的陪伴日记长图。所有内容会实时保存到本订单，可随时清空或重新生成。
            </p>
            <CompanionReportGenerator
              orderId={order.id}
              petName={order.pet_type || "毛孩子"}
              sitterName={order.store_name || undefined}
              onSavedChange={setSavedReport}
            />
          </section>
        )}

        {/* Cancel Confirmation */}
        {showCancelConfirm && (
          <section className="bg-destructive/10 border border-destructive/30 rounded-2xl p-5 space-y-3">
            <h2 className="font-bold text-destructive text-base flex items-center gap-2">
              <XCircle className="w-4 h-4" /> 确认取消订单？
            </h2>
            <p className="text-sm text-muted-foreground">取消后订单将无法恢复，已支付的金额将原路退回。</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowCancelConfirm(false)}>再想想</Button>
              <Button variant="destructive" size="sm" className="flex-1" onClick={handleCancelOrder} disabled={cancelling}>
                {cancelling ? "取消中..." : "确认取消"}
              </Button>
            </div>
          </section>
        )}

        {/* Cancelled Banner */}
        {order.order_status === "cancelled" && (
          <section className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 flex items-center gap-3">
            <XCircle className="w-6 h-6 text-destructive shrink-0" />
            <div>
              <p className="font-bold text-destructive">订单已取消</p>
              <p className="text-xs text-muted-foreground">如有疑问请联系客服</p>
            </div>
          </section>
        )}

        {isServiceOrder && (
          <EscrowStatusCard
            orderId={order.id}
            escrowStatus={order.escrow_status}
            orderStatus={order.order_status}
            amount={order.total_amount}
            onReleased={refetch}
          />
        )}
        {/* Quick links */}
        {["confirmed", "in_progress"].includes(order.order_status) && (
          <Button variant="hero" className="w-full" onClick={() => navigate(`/track/${order.id}`)}>
            📍 实时追踪司机位置
          </Button>
        )}
        {order.order_status === "completed" && (
          <Button variant="warm" className="w-full" onClick={() => navigate(`/rate/${order.id}`)}>
            ⭐ 评价本次行程
          </Button>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {canCancel && !showCancelConfirm && (
            <Button variant="destructive" className="flex-1" onClick={() => setShowCancelConfirm(true)}>
              <XCircle className="w-4 h-4 mr-1" /> 取消订单
            </Button>
          )}
          <Button variant="outline" className="flex-1" onClick={() => navigate("/merchant-appeal")}>
            <AlertTriangle className="w-4 h-4 mr-1" /> 商家申诉
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => navigate("/customer-service")}>联系客服</Button>
          <Button variant="hero" className="flex-1" onClick={() => navigate("/profile")}>返回</Button>
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
