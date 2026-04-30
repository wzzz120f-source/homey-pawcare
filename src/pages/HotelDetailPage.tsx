import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Star, MapPin, Phone, Hotel, Wifi, PawPrint, CalendarDays, Loader2, MessageSquare, Shield, CheckCircle2, Info, Utensils, Stethoscope, Car, Waves, Clock, FileText, AlertCircle, PartyPopper } from "lucide-react";
import { PET_TYPES, TIME_SLOTS } from "@/config/booking";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import BottomNav from "@/components/BottomNav";
import MediaPicker from "@/components/MediaPicker";
import MediaThumb from "@/components/MediaThumb";
import { type PreparedMedia, uploadPreparedMedia, revokePreviews } from "@/lib/mediaUpload";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { fetchAISummary, AIServiceError, getOfflineFallback } from "@/lib/aiSummary";
import {
  saveHotelDraft,
  loadHotelDraft,
  clearHotelDraft,
  saveHandoffContext,
  formatSavedAt,
  type HotelBookingDraft,
} from "@/lib/bookingDraft";
import { Sparkles, Copy, Download, Headphones, Save, RefreshCw, FileDown, X } from "lucide-react";

import hotelDogFriendly from "@/assets/hotel-dog-friendly.jpg";
import hotelCatFriendly from "@/assets/hotel-cat-friendly.jpg";
import hotelPetSpa from "@/assets/hotel-pet-spa.jpg";
import hotelLuxury from "@/assets/hotel-luxury.jpg";
import hotelGarden from "@/assets/hotel-garden.jpg";
import hotelBudget from "@/assets/hotel-budget.jpg";

const ALL_IMAGES = [hotelDogFriendly, hotelCatFriendly, hotelPetSpa, hotelLuxury, hotelGarden, hotelBudget];

const getHotelImage = (hotel: { name: string; image_url: string | null }, index: number): string => {
  if (hotel.image_url && hotel.image_url.startsWith("http")) return hotel.image_url;
  if (hotel.name.includes("猫")) return hotelCatFriendly;
  if (hotel.name.includes("SPA") || hotel.name.includes("spa") || hotel.name.includes("皇家")) return hotelLuxury;
  if (hotel.name.includes("花园") || hotel.name.includes("乐园")) return hotelGarden;
  if (hotel.name.includes("经济") || hotel.name.includes("友汇")) return hotelBudget;
  return ALL_IMAGES[index % ALL_IMAGES.length];
};

const AMENITY_ICONS: Record<string, any> = {
  "免费WiFi": Wifi, "宠物泳池": Waves, "宠物SPA": Stethoscope, "私人泳池": Waves,
  "宠物餐厅": Utensils, "有机餐食": Utensils, "停车场": Car, "24h监控": Shield,
  "实时监控": Shield, "医疗团队": Stethoscope, "专属管家": PawPrint,
};

const ROOM_TYPES = [
  { name: "标准单宠房", desc: "适合小型犬/猫，含基础设施", priceLabel: "起" },
  { name: "豪华双宠房", desc: "适合两只宠物同住，空间更大", priceLabel: "中" },
  { name: "VIP套房", desc: "独立活动区+专属管家服务", priceLabel: "高" },
];

const CHECK_IN_RULES = [
  "入住需提供宠物健康证明及疫苗接种记录",
  "宠物需佩戴牵引绳，攻击性犬种需佩戴嘴套",
  "入住时间：14:00 后 / 退房时间：12:00 前",
  "如宠物损坏酒店设施需照价赔偿",
  "特殊饮食需求请提前24小时告知",
  "紧急情况下酒店有权联系宠物主人",
];

interface PetHotel {
  id: string; name: string; address: string; longitude: number; latitude: number;
  rating: number; reviews_count: number; price_min: number; price_max: number;
  tags: string[]; amenities: string[]; phone: string | null;
  image_url: string | null; description: string | null;
}

interface HotelReview {
  id: string; hotel_id: string; user_id: string; rating: number;
  content: string | null; images: string[]; created_at: string;
  profiles?: { username: string; avatar_url: string | null } | null;
}

const HotelDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [hotel, setHotel] = useState<PetHotel | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<HotelReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Booking
  const [bookingDate, setBookingDate] = useState("");
  const [bookingNights, setBookingNights] = useState(1);
  const [bookingPetType, setBookingPetType] = useState("");
  const [bookingTimeSlot, setBookingTimeSlot] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [pickupMethod, setPickupMethod] = useState<"self" | "pickup">("self");
  const [pickupAddress, setPickupAddress] = useState("");
  const [bookingStep, setBookingStep] = useState<"form" | "confirm">("form");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [receipt, setReceipt] = useState<{
    orderNo: string;
    petLabel: string;
    date: string;
    nights: number;
    timeSlot: string;
    notes: string;
    pickupMethod: "self" | "pickup";
    pickupAddress: string;
    hotelName: string;
    hotelAddress: string;
    total: number;
    estimatedArrival: string;
  } | null>(null);
  const [aiReceiptSummary, setAiReceiptSummary] = useState<string>("");
  const [aiReceiptLoading, setAiReceiptLoading] = useState(false);
  const [aiReceiptError, setAiReceiptError] = useState<AIServiceError | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<HotelBookingDraft | null>(null);
  const receiptCardRef = useRef<HTMLDivElement>(null);

  const fetchReceiptSummary = (rec: NonNullable<typeof receipt>) => {
    let cancelled = false;
    setAiReceiptLoading(true);
    setAiReceiptError(null);
    fetchAISummary("booking_receipt", {
      订单号: rec.orderNo,
      宠物类型: rec.petLabel,
      入住日期: rec.date,
      入住时段: rec.timeSlot,
      时长: `${rec.nights} 晚`,
      门店: `${rec.hotelName}（${rec.hotelAddress}）`,
      接送方式: rec.pickupMethod === "pickup" ? `专车接送 · 起点：${rec.pickupAddress}` : "自行送达",
      预计抵达: rec.estimatedArrival,
      备注: rec.notes || "无",
      总金额: `¥${rec.total}`,
    })
      .then((r) => { if (!cancelled) setAiReceiptSummary(r.text || getOfflineFallback("booking_receipt")); })
      .catch((err: AIServiceError) => {
        if (!cancelled) {
          setAiReceiptSummary(getOfflineFallback("booking_receipt"));
          setAiReceiptError(err);
        }
      })
      .finally(() => { if (!cancelled) setAiReceiptLoading(false); });
    return () => { cancelled = true; };
  };

  // Generate AI booking summary when receipt is shown
  useEffect(() => {
    if (!receipt) {
      setAiReceiptSummary(""); setAiReceiptError(null);
      return;
    }
    return fetchReceiptSummary(receipt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt]);

  const copyReceipt = async () => {
    if (!receipt) return;
    const lines = [
      `【萌宠到家 · 预订成功】`,
      `订单号：${receipt.orderNo}`,
      `酒店：${receipt.hotelName}（${receipt.hotelAddress}）`,
      `宠物：${receipt.petLabel}`,
      `入住：${receipt.date} ${receipt.timeSlot}`,
      `时长：${receipt.nights} 晚`,
      `接送：${receipt.pickupMethod === "pickup" ? `专车 · 起点：${receipt.pickupAddress}` : "自行送达"}`,
      `预计抵达：${receipt.estimatedArrival}`,
      receipt.notes && `备注：${receipt.notes}`,
      `合计：¥${receipt.total}`,
      aiReceiptSummary && `\nAI 摘要：\n${aiReceiptSummary}`,
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      toast.success("✅ 已复制到剪贴板");
    } catch {
      toast.error("复制失败，请手动选择文本");
    }
  };

  // Build a plain-text version of the receipt — also used as PDF fallback
  // when html2canvas/jsPDF fail to load or render (slow network, OOM, etc.).
  const buildReceiptText = (rec: NonNullable<typeof receipt>) =>
    [
      `【萌宠到家 · 预订成功】`,
      `订单号：${rec.orderNo}`,
      `酒店：${rec.hotelName}（${rec.hotelAddress}）`,
      `宠物：${rec.petLabel}`,
      `入住：${rec.date} ${rec.timeSlot}`,
      `时长：${rec.nights} 晚`,
      `接送：${rec.pickupMethod === "pickup" ? `专车 · 起点：${rec.pickupAddress}` : "自行送达"}`,
      `预计抵达：${rec.estimatedArrival}`,
      rec.notes && `备注：${rec.notes}`,
      `合计：¥${rec.total}`,
      aiReceiptSummary && `\nAI 摘要：\n${aiReceiptSummary}`,
    ].filter(Boolean).join("\n");

  const downloadReceiptText = (rec: NonNullable<typeof receipt>) => {
    try {
      const blob = new Blob([buildReceiptText(rec)], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `booking-${rec.orderNo}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("✅ 已下载纯文本订单");
    } catch {
      toast.error("下载失败，请手动复制");
    }
  };

  const downloadReceiptPDF = async () => {
    if (!receipt || !receiptCardRef.current) return;
    setPdfError(null);
    try {
      toast.loading("正在生成 PDF…", { id: "pdf" });
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(receiptCardRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = Math.min((pageW - 40) / canvas.width, (pageH - 40) / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      pdf.addImage(imgData, "PNG", (pageW - w) / 2, 20, w, h);
      pdf.save(`booking-${receipt.orderNo}.pdf`);
      toast.success("✅ PDF 已下载", { id: "pdf" });
    } catch (e) {
      console.error("PDF 生成失败:", e);
      const msg = e instanceof Error ? e.message : "未知错误";
      setPdfError(msg);
      toast.error("PDF 生成失败，已切换为纯文本下载", { id: "pdf" });
      // Auto-fallback to plain text so the user always gets a file.
      downloadReceiptText(receipt);
    }
  };

  // Persist the in-progress / failed booking so the user can resume from the
  // hotel page later (or 转人工客服 with full context).
  const persistDraft = (reason?: string) => {
    if (!hotel) return false;
    return saveHotelDraft({
      hotelId: hotel.id,
      hotelName: hotel.name,
      hotelAddress: hotel.address,
      bookingDate: receipt?.date || bookingDate,
      bookingNights: receipt?.nights || bookingNights,
      bookingPetType: receipt?.petLabel ? bookingPetType : bookingPetType,
      bookingTimeSlot: receipt?.timeSlot || bookingTimeSlot,
      bookingNotes: receipt?.notes ?? bookingNotes,
      pickupMethod: receipt?.pickupMethod || pickupMethod,
      pickupAddress: receipt?.pickupAddress || pickupAddress,
    });
  };

  const saveBookingDraft = () => {
    if (persistDraft()) toast.success("草稿已保存，下次回到本酒店将自动恢复");
    else toast.error("草稿保存失败");
  };

  // Unified 转人工 entry — saves a context snapshot so 客服 sees the order/form.
  const handoffToCustomerService = (
    reason: "ai_rate_limit" | "ai_credit" | "ai_offline" | "pdf_failed" | "manual",
  ) => {
    persistDraft(reason);
    saveHandoffContext({
      source: receipt ? "receipt" : "hotel",
      reason,
      summary: receipt
        ? `酒店订单 ${receipt.orderNo}（${receipt.hotelName}） · ${receipt.petLabel} · ${receipt.date} ${receipt.timeSlot} · 共 ${receipt.nights} 晚 · ¥${receipt.total}`
        : `酒店预订草稿：${hotel?.name || "—"} · 宠物 ${bookingPetType || "未选"} · ${bookingDate || "未选日期"} ${bookingTimeSlot || ""}`,
      payload: {
        reason,
        receipt: receipt || null,
        hotelId: hotel?.id,
        hotelName: hotel?.name,
        pdfError: pdfError || undefined,
      },
    });
    setReceipt(null);
    navigate("/customer-service");
  };

  // Review form
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [reviewMedia, setReviewMedia] = useState<PreparedMedia[]>([]);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Carousel state (must be declared before any conditional return)
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setCurrentSlide(carouselApi.selectedScrollSnap());
    onSelect();
    carouselApi.on("select", onSelect);
    return () => { carouselApi.off("select", onSelect); };
  }, [carouselApi]);

  useEffect(() => {
    if (!id) return;
    supabase.from("pet_hotels" as any).select("*").eq("id", id).single()
      .then(({ data, error }) => {
        if (data) setHotel(data as any);
        if (error) console.error(error);
        setLoading(false);
      });
    fetchReviews(id);
    // Surface any saved draft for this hotel so the user can resume.
    const draft = loadHotelDraft();
    if (draft && draft.hotelId === id) setPendingDraft(draft);
  }, [id]);

  const restoreDraft = () => {
    if (!pendingDraft) return;
    if (pendingDraft.bookingDate) setBookingDate(pendingDraft.bookingDate);
    if (pendingDraft.bookingNights) setBookingNights(pendingDraft.bookingNights);
    if (pendingDraft.bookingPetType) setBookingPetType(pendingDraft.bookingPetType);
    if (pendingDraft.bookingTimeSlot) setBookingTimeSlot(pendingDraft.bookingTimeSlot);
    if (pendingDraft.bookingNotes !== undefined) setBookingNotes(pendingDraft.bookingNotes);
    if (pendingDraft.pickupMethod) setPickupMethod(pendingDraft.pickupMethod);
    if (pendingDraft.pickupAddress) setPickupAddress(pendingDraft.pickupAddress);
    setShowBooking(true);
    setBookingStep("form");
    setPendingDraft(null);
    clearHotelDraft();
    toast.success("已恢复上次草稿，请核对后继续");
  };

  const dismissDraft = () => {
    setPendingDraft(null);
    clearHotelDraft();
  };

  const fetchReviews = async (hotelId: string) => {
    setLoadingReviews(true);
    const { data } = await supabase
      .from("hotel_reviews" as any)
      .select("*, profiles:user_id(username, avatar_url)")
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: false });
    if (data) setReviews(data as any);
    setLoadingReviews(false);
  };

  // Validation errors (only surfaced after submit attempt)
  const bookingErrors = {
    petType: !bookingPetType ? "请选择宠物类型" : "",
    date: !bookingDate ? "请选择入住日期" : "",
    timeSlot: !bookingTimeSlot ? "请选择入住时段" : "",
    pickupAddress:
      pickupMethod === "pickup" && !pickupAddress.trim() ? "请填写接送地址" : "",
  } as const;
  const hasBookingErrors = Object.values(bookingErrors).some(Boolean);

  const resetBookingForm = () => {
    setBookingStep("form");
    setSubmitAttempted(false);
    setBookingDate(""); setBookingNights(1); setBookingPetType("");
    setBookingTimeSlot(""); setBookingNotes(""); setPickupMethod("self");
    setPickupAddress("");
  };

  const goToConfirm = () => {
    setSubmitAttempted(true);
    if (hasBookingErrors) {
      toast.error("请检查并补充必填项");
      return;
    }
    setBookingStep("confirm");
  };

  const handleBooking = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!hotel) return;
    setSubmitting(true);
    try {
      const totalAmount = hotel.price_min * bookingNights;
      const petLabel = PET_TYPES.find(p => p.id === bookingPetType)?.label || bookingPetType;
      const checkInTime = pickupMethod === "pickup"
        ? `${bookingDate} ${bookingTimeSlot} 由专车送达酒店`
        : `${bookingDate} ${bookingTimeSlot} 自行抵达酒店`;
      const composedNotes = [
        `宠物：${petLabel}`,
        `入住${bookingNights}晚`,
        bookingNotes && `备注：${bookingNotes}`,
        pickupMethod === "pickup" && `接送地址：${pickupAddress}`,
      ].filter(Boolean).join("；");

      const { data, error } = await supabase.from("orders").insert({
        user_id: user.id,
        order_type: "hotel",
        service_type: `宠物友好酒店 - ${hotel.name}`,
        store_name: hotel.name,
        booking_date: bookingDate,
        booking_time: bookingTimeSlot,
        pet_type: bookingPetType,
        notes: composedNotes,
        total_amount: totalAmount,
        pickup_address: pickupMethod === "pickup" ? pickupAddress : hotel.address,
      }).select("order_no").single();
      if (error) throw error;

      setReceipt({
        orderNo: (data as any)?.order_no || "—",
        petLabel,
        date: bookingDate,
        nights: bookingNights,
        timeSlot: bookingTimeSlot,
        notes: bookingNotes,
        pickupMethod,
        pickupAddress,
        hotelName: hotel.name,
        hotelAddress: hotel.address,
        total: totalAmount,
        estimatedArrival: checkInTime,
      });
      setShowBooking(false);
      resetBookingForm();
      clearHotelDraft();
    } catch (err: any) {
      toast.error(err.message || "预订失败");
    } finally { setSubmitting(false); }
  };

  const submitReview = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!hotel) return;
    if (!reviewContent.trim()) { toast.error("请输入评价内容"); return; }
    setSubmittingReview(true);
    try {
      const mediaUrls: string[] = [];
      // Skip the live_photo_video sibling; store its url paired with the heic key
      for (const item of reviewMedia) {
        if (item.mediaType === "live_photo_video") continue; // pair handled below
        try {
          const { url } = await uploadPreparedMedia(
            supabase,
            "hotel-review-images",
            user.id,
            item,
            hotel.id
          );
          mediaUrls.push(url);
        } catch (e) {
          console.warn("酒店评价媒体上传失败", e);
        }
      }
      // Also upload the live_photo_video pieces so they exist on storage even if URL not in images[]
      for (const item of reviewMedia) {
        if (item.mediaType !== "live_photo_video") continue;
        try {
          await uploadPreparedMedia(supabase, "hotel-review-images", user.id, item, hotel.id);
        } catch (e) {
          console.warn("Live Photo 视频上传失败", e);
        }
      }
      const { error } = await supabase.from("hotel_reviews" as any).insert({
        hotel_id: hotel.id, user_id: user.id, rating: reviewRating,
        content: reviewContent, images: mediaUrls,
      });
      if (error) throw error;
      toast.success("评价发表成功！");
      setShowReviewForm(false);
      setReviewContent(""); setReviewRating(5);
      revokePreviews(reviewMedia);
      setReviewMedia([]);
      fetchReviews(hotel.id);
    } catch (err: any) { toast.error(err.message || "评价失败"); }
    finally { setSubmittingReview(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-nav">
        <Skeleton className="w-full h-56" />
        <div className="p-4 space-y-3"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-20 w-full" /></div>
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">酒店不存在</p>
      </div>
    );
  }

  // Build gallery: hero + 3 distinct images, deduped
  const heroImg = getHotelImage(hotel, 0);
  const galleryImages = Array.from(new Set([
    heroImg,
    ...ALL_IMAGES.filter(img => img !== heroImg).slice(0, 3),
  ]));

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Hero Image Carousel */}
      <div className="relative">
        <Carousel
          setApi={setCarouselApi}
          opts={{ loop: true }}
          plugins={[Autoplay({ delay: 4000, stopOnInteraction: true })]}
          className="w-full"
        >
          <CarouselContent>
            {galleryImages.map((img, idx) => (
              <CarouselItem key={idx}>
                <img src={img} alt={`${hotel.name} 实拍图 ${idx + 1}`} className="w-full h-56 object-cover" loading={idx === 0 ? "eager" : "lazy"} />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent pointer-events-none" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 min-w-[44px] min-h-[44px] flex items-center justify-center bg-background/80 backdrop-blur rounded-full z-10"
          aria-label="返回"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        {/* Indicator badge */}
        <div className="absolute top-4 right-4 z-10 bg-foreground/60 text-background text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur">
          {currentSlide + 1}/{galleryImages.length}
        </div>
        {/* Dots */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
          {galleryImages.map((_, idx) => (
            <button
              key={idx}
              onClick={() => carouselApi?.scrollTo(idx)}
              aria-label={`跳到第${idx + 1}张图片`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                idx === currentSlide ? "w-5 bg-white" : "w-1.5 bg-white/50"
              )}
            />
          ))}
        </div>
        <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
          <h1 className="text-xl font-extrabold text-white drop-shadow-lg">{hotel.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-white font-bold text-sm">{Number(hotel.rating).toFixed(1)}</span>
            </div>
            <span className="text-white/70 text-xs">({hotel.reviews_count}条评价)</span>
          </div>
        </div>
      </div>

      <main className="max-w-lg mx-auto">
        {pendingDraft && (
          <div className="mx-4 mt-3 rounded-xl border border-primary/40 bg-primary/5 p-3 flex items-start gap-2 animate-fade-in-up">
            <Save className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">检测到上次未完成的预订草稿</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                保存于 {formatSavedAt(pendingDraft.savedAt)}
                {pendingDraft.bookingDate && ` · ${pendingDraft.bookingDate}`}
                {pendingDraft.bookingTimeSlot && ` ${pendingDraft.bookingTimeSlot}`}
                {pendingDraft.bookingPetType && ` · 宠物 ${pendingDraft.bookingPetType}`}
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={restoreDraft}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-primary text-primary-foreground"
                >
                  恢复并继续
                </button>
                <button
                  type="button"
                  onClick={dismissDraft}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-card border border-border text-muted-foreground"
                >
                  忽略
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissDraft}
              aria-label="关闭"
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {/* Quick Info */}
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <span>{hotel.address}</span>
          </div>
          {hotel.phone && (
            <a href={`tel:${hotel.phone}`} className="flex items-center gap-2 text-sm text-primary">
              <Phone className="w-4 h-4" />
              <span>{hotel.phone}</span>
            </a>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 flex-wrap">
              {hotel.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
            <span className="text-lg font-extrabold text-primary">¥{hotel.price_min}-{hotel.price_max}<span className="text-xs font-normal text-muted-foreground">/晚</span></span>
          </div>
          {hotel.description && <p className="text-sm text-muted-foreground leading-relaxed">{hotel.description}</p>}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="rooms" className="px-4">
          <TabsList className="w-full grid grid-cols-4 h-10">
            <TabsTrigger value="rooms" className="text-xs">房型</TabsTrigger>
            <TabsTrigger value="amenities" className="text-xs">设施</TabsTrigger>
            <TabsTrigger value="rules" className="text-xs">须知</TabsTrigger>
            <TabsTrigger value="reviews" className="text-xs">评价</TabsTrigger>
          </TabsList>

          {/* Room Types */}
          <TabsContent value="rooms" className="space-y-3 mt-3">
            {ROOM_TYPES.map((room, i) => {
              const price = i === 0 ? hotel.price_min : i === 1 ? Math.round((hotel.price_min + hotel.price_max) / 2) : hotel.price_max;
              return (
                <Card key={room.name}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Hotel className="w-4 h-4 text-primary" />
                        {room.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">{room.desc}</p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-base font-extrabold text-primary">¥{price}</p>
                      <p className="text-[10px] text-muted-foreground">/晚</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Amenities */}
          <TabsContent value="amenities" className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              {hotel.amenities.map(a => {
                const Icon = AMENITY_ICONS[a] || CheckCircle2;
                return (
                  <div key={a} className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2.5">
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs text-foreground">{a}</span>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Check-in Rules */}
          <TabsContent value="rules" className="mt-3 space-y-2">
            {CHECK_IN_RULES.map((rule, i) => (
              <div key={i} className="flex items-start gap-2 bg-secondary rounded-xl px-3 py-2.5">
                <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-xs text-foreground leading-relaxed">{rule}</span>
              </div>
            ))}
          </TabsContent>

          {/* Reviews */}
          <TabsContent value="reviews" className="mt-3 space-y-3">
            <Button
              variant="outline" className="w-full"
              onClick={() => {
                if (!user) { navigate("/auth"); return; }
                setShowReviewForm(true);
              }}
            >
              <Star className="w-4 h-4 mr-1" /> 写评价
            </Button>

            {loadingReviews ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2"><Skeleton className="w-8 h-8 rounded-full" /><Skeleton className="h-4 w-20" /></div>
                  <Skeleton className="h-12 w-full" />
                </div>
              ))
            ) : reviews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无评价</p>
              </div>
            ) : reviews.map(review => (
              <Card key={review.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {(review.profiles as any)?.username?.charAt(0) || "U"}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{(review.profiles as any)?.username || "用户"}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(review.created_at).toLocaleDateString("zh-CN")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={cn("w-3 h-3", s <= review.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30")} />
                      ))}
                    </div>
                  </div>
                  {review.content && <p className="text-xs text-foreground leading-relaxed">{review.content}</p>}
                  {review.images?.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {review.images.map((url, idx) => {
                        const isVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
                        return (
                          <MediaThumb
                            key={idx}
                            url={url}
                            mediaType={isVideo ? "video" : "image"}
                            alt="酒店评价"
                            className="w-16 h-16 rounded-lg"
                          />
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>

      {/* Bottom CTA */}
      <div className="fixed bottom-16 left-0 right-0 z-30 bg-background/90 backdrop-blur border-t border-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <span className="text-lg font-extrabold text-primary">¥{hotel.price_min}</span>
            <span className="text-xs text-muted-foreground">/晚起</span>
          </div>
          <Button onClick={() => setShowBooking(true)} className="px-8">
            <CalendarDays className="w-4 h-4 mr-1" /> 立即预订
          </Button>
        </div>
      </div>

      {/* Booking Modal */}
      {showBooking && (
        <div
          className="fixed inset-0 z-50 bg-foreground/50 flex items-end justify-center"
          onClick={() => { setShowBooking(false); resetBookingForm(); }}
        >
          <div
            className="bg-background w-full max-w-lg rounded-t-2xl p-5 space-y-4 animate-fade-in-up max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              {bookingStep === "form" ? `预订 ${hotel.name}` : "确认预订信息"}
            </h3>

            {bookingStep === "form" ? (
              <div className="space-y-4">
                {/* Pet type */}
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
                    <PawPrint className="w-3.5 h-3.5 text-primary" /> 宠物类型 <span className="text-destructive">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {PET_TYPES.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setBookingPetType(p.id)}
                        className={cn(
                          "flex flex-col items-center gap-0.5 py-2 rounded-xl text-xs font-medium border transition-all",
                          bookingPetType === p.id
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-secondary border-transparent text-foreground",
                        )}
                      >
                        <span className="text-xl">{p.emoji}</span>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {submitAttempted && bookingErrors.petType && (
                    <p role="alert" className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {bookingErrors.petType}
                    </p>
                  )}
                </div>

                {/* Date */}
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5 text-primary" /> 入住日期 <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={e => setBookingDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className={cn(
                      "w-full px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-2 focus:ring-primary",
                      submitAttempted && bookingErrors.date && "ring-2 ring-destructive",
                    )}
                  />
                  {submitAttempted && bookingErrors.date && (
                    <p role="alert" className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {bookingErrors.date}
                    </p>
                  )}
                </div>

                {/* Time slot */}
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-primary" /> 预约入住时段 <span className="text-destructive">*</span>
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {TIME_SLOTS.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setBookingTimeSlot(t)}
                        className={cn(
                          "py-2 rounded-lg text-xs font-medium border transition-all",
                          bookingTimeSlot === t
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary border-transparent text-foreground",
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {submitAttempted && bookingErrors.timeSlot && (
                    <p role="alert" className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {bookingErrors.timeSlot}
                    </p>
                  )}
                </div>

                {/* Nights */}
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1 block">入住天数</label>
                  <div className="flex items-center gap-3">
                    <button className="w-10 h-10 rounded-xl bg-secondary text-foreground font-bold text-lg" onClick={() => setBookingNights(Math.max(1, bookingNights - 1))}>-</button>
                    <span className="text-lg font-extrabold text-foreground w-8 text-center">{bookingNights}</span>
                    <button className="w-10 h-10 rounded-xl bg-secondary text-foreground font-bold text-lg" onClick={() => setBookingNights(Math.min(30, bookingNights + 1))}>+</button>
                    <span className="text-sm text-muted-foreground">晚</span>
                  </div>
                </div>

                {/* Pickup method */}
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
                    <Car className="w-3.5 h-3.5 text-primary" /> 接送方式 <span className="text-destructive">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPickupMethod("self")}
                      className={cn(
                        "py-2.5 rounded-xl text-xs font-medium border transition-all",
                        pickupMethod === "self"
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-secondary border-transparent text-foreground",
                      )}
                    >
                      🚶 自行送达
                    </button>
                    <button
                      type="button"
                      onClick={() => setPickupMethod("pickup")}
                      className={cn(
                        "py-2.5 rounded-xl text-xs font-medium border transition-all",
                        pickupMethod === "pickup"
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-secondary border-transparent text-foreground",
                      )}
                    >
                      🚗 专车接送
                    </button>
                  </div>
                  {pickupMethod === "pickup" && (
                    <>
                      <input
                        type="text"
                        value={pickupAddress}
                        onChange={e => setPickupAddress(e.target.value)}
                        placeholder="请输入接送起点地址"
                        className={cn(
                          "mt-2 w-full px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-2 focus:ring-primary",
                          submitAttempted && bookingErrors.pickupAddress && "ring-2 ring-destructive",
                        )}
                      />
                      {submitAttempted && bookingErrors.pickupAddress && (
                        <p role="alert" className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {bookingErrors.pickupAddress}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-primary" /> 备注信息
                  </label>
                  <Textarea
                    value={bookingNotes}
                    onChange={e => setBookingNotes(e.target.value)}
                    maxLength={200}
                    placeholder="如：宠物饮食偏好、特殊需求等（选填）"
                    className="min-h-[72px] rounded-xl bg-secondary border-none text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground text-right mt-0.5">{bookingNotes.length}/200</p>
                </div>

                {/* Total */}
                <div className="bg-secondary rounded-xl p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">房费</span>
                    <span className="text-foreground">¥{hotel.price_min}/晚 × {bookingNights}晚</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold border-t border-border pt-2 mt-2">
                    <span className="text-foreground">合计</span>
                    <span className="text-primary">¥{hotel.price_min * bookingNights}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => { setShowBooking(false); resetBookingForm(); }}>取消</Button>
                  <Button className="flex-1" onClick={goToConfirm}>下一步：确认</Button>
                </div>
              </div>
            ) : (
              /* Confirm step */
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">请核对以下信息，确认后将提交预订。</p>
                <div className="bg-secondary rounded-xl p-3 text-sm space-y-2">
                  <Row label="🏨 酒店" value={hotel.name} />
                  <Row label="🐾 宠物" value={PET_TYPES.find(p => p.id === bookingPetType)?.label || "—"} />
                  <Row label="📅 入住日期" value={`${bookingDate} ${bookingTimeSlot}`} />
                  <Row label="🛏️ 时长" value={`${bookingNights} 晚`} />
                  <Row label="🚗 接送" value={pickupMethod === "pickup" ? `专车接送 · ${pickupAddress}` : "自行送达"} />
                  {bookingNotes && <Row label="📝 备注" value={bookingNotes} />}
                  <div className="flex justify-between border-t border-border pt-2 mt-1 text-base font-extrabold">
                    <span>合计</span>
                    <span className="text-primary">¥{hotel.price_min * bookingNights}</span>
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setBookingStep("form")}>返回修改</Button>
                  <Button className="flex-1" onClick={handleBooking} disabled={submitting}>
                    {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                    确认提交
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receipt Dialog */}
      {receipt && (
        <div className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4" onClick={() => setReceipt(null)}>
          <div
            className="bg-background w-full max-w-md rounded-2xl p-5 space-y-4 animate-fade-in-up"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-labelledby="receipt-title"
          >
            <div ref={receiptCardRef} className="bg-background space-y-4">
              <div className="text-center space-y-1">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <PartyPopper className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 id="receipt-title" className="text-lg font-extrabold text-foreground">预订成功！</h3>
                <p className="text-xs text-muted-foreground">订单号：{receipt.orderNo}</p>
              </div>
              <div className="bg-secondary rounded-xl p-3 text-sm space-y-2">
                <Row label="🏨 酒店" value={`${receipt.hotelName}（${receipt.hotelAddress}）`} />
                <Row label="🐾 宠物" value={receipt.petLabel} />
                <Row label="📅 入住" value={`${receipt.date} ${receipt.timeSlot}`} />
                <Row label="🛏️ 时长" value={`${receipt.nights} 晚`} />
                <Row
                  label="🚗 接送/抵达"
                  value={receipt.pickupMethod === "pickup"
                    ? `专车接送 · 起点：${receipt.pickupAddress}`
                    : "自行送达酒店"}
                />
                <Row label="⏰ 预计抵达" value={receipt.estimatedArrival} />
                {receipt.notes && <Row label="📝 备注" value={receipt.notes} />}
                <div className="flex justify-between border-t border-border pt-2 mt-1 text-base font-extrabold">
                  <span>已下单金额</span>
                  <span className="text-primary">¥{receipt.total}</span>
                </div>
              </div>

              {/* AI 智能摘要 */}
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="w-3.5 h-3.5" /> AI 订单摘要
                  </div>
                  <div className="flex items-center gap-1">
                    {aiReceiptError && (
                      <button
                        type="button"
                        onClick={() => receipt && fetchReceiptSummary(receipt)}
                        className="text-[11px] text-primary hover:underline flex items-center gap-1"
                        aria-label="重新生成 AI 摘要"
                      >
                        <RefreshCw className="w-3 h-3" /> 重试
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={copyReceipt}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1"
                      aria-label="复制订单与 AI 摘要"
                    >
                      <Copy className="w-3 h-3" /> 复制
                    </button>
                    <button
                      type="button"
                      onClick={downloadReceiptPDF}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1"
                      aria-label="下载订单 PDF"
                    >
                      <Download className="w-3 h-3" /> PDF
                    </button>
                    {pdfError && (
                      <button
                        type="button"
                        onClick={() => receipt && downloadReceiptText(receipt)}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-secondary border border-border text-foreground flex items-center gap-1"
                        aria-label="下载纯文本订单"
                      >
                        <FileDown className="w-3 h-3" /> 纯文本
                      </button>
                    )}
                  </div>
                </div>
                {aiReceiptLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> AI 正在为你梳理订单要点…
                  </div>
                ) : aiReceiptSummary ? (
                  <div className="prose prose-sm max-w-none text-foreground [&_p]:my-1 [&_strong]:text-primary">
                    <ReactMarkdown>{aiReceiptSummary}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{getOfflineFallback("booking_receipt")}</p>
                )}
                {aiReceiptError && (
                  <div className="flex flex-wrap gap-2 pt-1.5 border-t border-primary/15">
                    <p className="w-full text-[11px] text-amber-600 dark:text-amber-400">
                      {aiReceiptError.kind === "rate_limit"
                        ? "⚠️ 请求过于频繁。"
                        : aiReceiptError.kind === "credit"
                          ? "⚠️ AI 额度不足。"
                          : "⚠️ AI 暂不可用。"}
                      可改用人工客服，或保存草稿稍后继续操作。
                    </p>
                    <button
                      type="button"
                      onClick={() => handoffToCustomerService(
                        aiReceiptError.kind === "rate_limit" ? "ai_rate_limit"
                        : aiReceiptError.kind === "credit" ? "ai_credit"
                        : "ai_offline"
                      )}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-primary text-primary-foreground flex items-center gap-1"
                    >
                      <Headphones className="w-3 h-3" /> 转人工客服
                    </button>
                    <button
                      type="button"
                      onClick={saveBookingDraft}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-card border border-border flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" /> 保存草稿
                    </button>
                  </div>
                )}
                {pdfError && (
                  <div className="flex flex-wrap gap-2 pt-1.5 border-t border-primary/15">
                    <p className="w-full text-[11px] text-amber-600 dark:text-amber-400">
                      ⚠️ PDF 生成失败：{pdfError.slice(0, 60)}。已自动尝试纯文本下载，可重试或转人工。
                    </p>
                    <button
                      type="button"
                      onClick={downloadReceiptPDF}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> 重试 PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => receipt && downloadReceiptText(receipt)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-card border border-border flex items-center gap-1"
                    >
                      <FileDown className="w-3 h-3" /> 改下载纯文本
                    </button>
                    <button
                      type="button"
                      onClick={() => handoffToCustomerService("pdf_failed")}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-card border border-border flex items-center gap-1"
                    >
                      <Headphones className="w-3 h-3" /> 转人工客服
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setReceipt(null)}>继续浏览</Button>
              <Button className="flex-1" onClick={() => { setReceipt(null); navigate("/orders"); }}>查看订单</Button>
            </div>
          </div>
        </div>
      )}

      {/* Review Form Modal */}
      {showReviewForm && (
        <div className="fixed inset-0 z-50 bg-foreground/50 flex items-end justify-center" onClick={() => setShowReviewForm(false)}>
          <div className="bg-background w-full max-w-lg rounded-t-2xl p-5 space-y-4 animate-fade-in-up max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-foreground">写评价</h3>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">评分</label>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => setReviewRating(s)}>
                    <Star className={cn("w-7 h-7", s <= reviewRating ? "text-amber-500 fill-amber-500" : "text-muted-foreground")} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-1 block">评价内容</label>
              <Textarea value={reviewContent} onChange={e => setReviewContent(e.target.value)}
                placeholder="分享您和毛孩子的入住体验..." className="min-h-[100px] rounded-xl bg-secondary border-none" />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">上传媒体（图片 / 视频 / Live Photo）</label>
              <MediaPicker value={reviewMedia} onChange={setReviewMedia} maxItems={9} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowReviewForm(false)}>取消</Button>
              <Button className="flex-1" onClick={submitReview} disabled={submittingReview}>
                {submittingReview && <Loader2 className="w-4 h-4 animate-spin mr-1" />} 发表评价
              </Button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3">
    <span className="text-muted-foreground shrink-0">{label}</span>
    <span className="text-foreground text-right break-all">{value}</span>
  </div>
);

export default HotelDetailPage;
