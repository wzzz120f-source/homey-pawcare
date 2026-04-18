import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Star, MapPin, Phone, Hotel, Wifi, PawPrint, CalendarDays, Loader2, MessageSquare, Shield, CheckCircle2, Info, Utensils, Stethoscope, Car, Waves } from "lucide-react";
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
  const [submitting, setSubmitting] = useState(false);
  const [showBooking, setShowBooking] = useState(false);

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
  }, [id]);

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

  const handleBooking = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!hotel || !bookingDate) { toast.error("请选择入住日期"); return; }
    setSubmitting(true);
    try {
      const totalAmount = hotel.price_min * bookingNights;
      const { error } = await supabase.from("orders").insert({
        user_id: user.id, order_type: "hotel",
        service_type: `宠物友好酒店 - ${hotel.name}`,
        store_name: hotel.name, booking_date: bookingDate,
        notes: `入住${bookingNights}晚，地址：${hotel.address}`,
        total_amount: totalAmount, pickup_address: hotel.address,
      });
      if (error) throw error;
      toast.success("预订成功！");
      setShowBooking(false);
      navigate("/profile");
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
      <div className="min-h-screen bg-background pb-20">
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
    <div className="min-h-screen bg-background pb-24">
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
                      {review.images.map((img, idx) => (
                        <img key={idx} src={img} alt="" className="w-16 h-16 rounded-lg object-cover" loading="lazy" />
                      ))}
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
        <div className="fixed inset-0 z-50 bg-foreground/50 flex items-end justify-center" onClick={() => setShowBooking(false)}>
          <div className="bg-background w-full max-w-lg rounded-t-2xl p-5 space-y-4 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" /> 预订 {hotel.name}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">入住日期</label>
                <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">入住天数</label>
                <div className="flex items-center gap-3">
                  <button className="w-10 h-10 rounded-xl bg-secondary text-foreground font-bold text-lg" onClick={() => setBookingNights(Math.max(1, bookingNights - 1))}>-</button>
                  <span className="text-lg font-extrabold text-foreground w-8 text-center">{bookingNights}</span>
                  <button className="w-10 h-10 rounded-xl bg-secondary text-foreground font-bold text-lg" onClick={() => setBookingNights(Math.min(30, bookingNights + 1))}>+</button>
                  <span className="text-sm text-muted-foreground">晚</span>
                </div>
              </div>
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
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowBooking(false)}>取消</Button>
              <Button className="flex-1" onClick={handleBooking} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                确认预订
              </Button>
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
              <label className="text-sm font-semibold text-foreground mb-2 block">上传图片 ({reviewImages.length}/9)</label>
              <div className="flex flex-wrap gap-2">
                {reviewPreviews.map((src, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => removeImage(idx)} className="absolute top-0.5 right-0.5 bg-foreground/60 text-background rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {reviewImages.length < 9 && (
                  <button onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-lg bg-secondary border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-primary">
                    <Camera className="w-5 h-5 text-muted-foreground" /><span className="text-[10px] text-muted-foreground">添加</span>
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
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

export default HotelDetailPage;
