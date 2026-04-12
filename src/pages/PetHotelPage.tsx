import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Star, MapPin, Phone, LocateFixed, Hotel, Wifi, PawPrint, Car, CalendarDays, Loader2, Camera, X, MessageSquare, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import BottomNav from "@/components/BottomNav";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

declare global {
  interface Window {
    AMap: any;
    _AMapSecurityConfig: any;
  }
}

const AMAP_KEY = "f1be18c642140d1114b326946ab357cc";
const AMAP_SECURITY_KEY = "99a72147fee06b466b18e76ded5cc55c";

interface PetHotel {
  id: string;
  name: string;
  address: string;
  longitude: number;
  latitude: number;
  rating: number;
  reviews_count: number;
  price_min: number;
  price_max: number;
  tags: string[];
  amenities: string[];
  phone: string | null;
  image_url: string | null;
  description: string | null;
}

interface HotelReview {
  id: string;
  hotel_id: string;
  user_id: string;
  rating: number;
  content: string | null;
  images: string[];
  created_at: string;
  profiles?: { username: string; avatar_url: string | null } | null;
}

const PetHotelPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [hotels, setHotels] = useState<PetHotel[]>([]);
  const [loadingHotels, setLoadingHotels] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHotel, setSelectedHotel] = useState<PetHotel | null>(null);
  const [currentLocation, setCurrentLocation] = useState("");
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [bookingHotel, setBookingHotel] = useState<PetHotel | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingNights, setBookingNights] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Review state
  const [reviewHotel, setReviewHotel] = useState<PetHotel | null>(null);
  const [reviews, setReviews] = useState<HotelReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [reviewImages, setReviewImages] = useState<File[]>([]);
  const [reviewPreviews, setReviewPreviews] = useState<string[]>([]);
  const [submittingReview, setSubmittingReview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch hotels from DB
  useEffect(() => {
    supabase
      .from("pet_hotels" as any)
      .select("*")
      .eq("is_active", true)
      .order("rating", { ascending: false })
      .then(({ data, error }) => {
        if (data) setHotels(data as any);
        if (error) console.error(error);
        setLoadingHotels(false);
      });
  }, []);

  // Load AMap SDK
  useEffect(() => {
    if (window.AMap) { setLoaded(true); return; }
    window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_KEY };
    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.Geolocation,AMap.Geocoder,AMap.AutoComplete,AMap.Driving`;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Init map & markers when hotels loaded
  useEffect(() => {
    if (!loaded || !mapRef.current || mapInstance.current || hotels.length === 0) return;
    const map = new window.AMap.Map(mapRef.current, {
      zoom: 13,
      center: [hotels[0].longitude, hotels[0].latitude],
      mapStyle: "amap://styles/light",
    });
    mapInstance.current = map;

    hotels.forEach((h) => {
      const marker = new window.AMap.Marker({
        position: [h.longitude, h.latitude],
        title: h.name,
        label: {
          content: `<span style="font-size:12px;background:#fff;padding:2px 6px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.15)">${h.image_url || "🏨"} ${h.name.slice(0, 6)}</span>`,
          direction: "top",
        },
      });
      marker.on("click", () => { setSelectedHotel(h); planRouteToHotel(h, map); });
      map.add(marker);
    });

    const geo = new window.AMap.Geolocation({ enableHighAccuracy: true, timeout: 10000 });
    map.addControl(geo);
    geo.getCurrentPosition((status: string, result: any) => {
      if (status === "complete") {
        const { lng, lat } = result.position;
        const geocoder = new window.AMap.Geocoder();
        geocoder.getAddress([lng, lat], (s: string, r: any) => {
          if (s === "complete" && r.regeocode) setCurrentLocation(r.regeocode.formattedAddress);
        });
      }
    });
  }, [loaded, hotels]);

  const filteredHotels = hotels.filter((h) =>
    !searchQuery || h.name.includes(searchQuery) || h.tags.some((t) => t.includes(searchQuery))
  );

  const planRouteToHotel = (hotel: PetHotel, map?: any) => {
    const m = map || mapInstance.current;
    if (!loaded || !m) return;
    setSelectedHotel(hotel);
    setRouteInfo(null);

    const geocoder = new window.AMap.Geocoder();
    const startAddr = currentLocation || "上海市浦东新区张杨路500号";
    geocoder.getLocation(startAddr, (s: string, r: any) => {
      if (s !== "complete" || !r.geocodes[0]) return;
      const start = r.geocodes[0].location;
      m.clearMap();

      hotels.forEach((h) => {
        const marker = new window.AMap.Marker({ position: [h.longitude, h.latitude], title: h.name });
        m.add(marker);
      });

      const driving = new window.AMap.Driving({ map: m });
      driving.search(start, new window.AMap.LngLat(hotel.longitude, hotel.latitude), (status: string, result: any) => {
        if (status === "complete" && result.routes?.length > 0) {
          const route = result.routes[0];
          setRouteInfo({
            distance: `${(route.distance / 1000).toFixed(1)}公里`,
            duration: `${Math.ceil(route.time / 60)}分钟`,
          });
        }
      });
    });
  };

  const handleBooking = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!bookingHotel || !bookingDate) { toast.error("请选择入住日期"); return; }

    setSubmitting(true);
    try {
      const totalAmount = bookingHotel.price_min * bookingNights;
      const { error } = await supabase.from("orders").insert({
        user_id: user.id,
        order_type: "hotel",
        service_type: `宠物友好酒店 - ${bookingHotel.name}`,
        store_name: bookingHotel.name,
        booking_date: bookingDate,
        notes: `入住${bookingNights}晚，地址：${bookingHotel.address}`,
        total_amount: totalAmount,
        pickup_address: bookingHotel.address,
      });
      if (error) throw error;
      toast.success("预订成功！");
      setBookingHotel(null);
      navigate("/profile");
    } catch (err: any) {
      toast.error(err.message || "预订失败");
    } finally {
      setSubmitting(false);
    }
  };

  // ===== Review Functions =====
  const fetchReviews = async (hotelId: string) => {
    setLoadingReviews(true);
    const { data, error } = await supabase
      .from("hotel_reviews" as any)
      .select("*, profiles:user_id(username, avatar_url)")
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: false });
    if (data) setReviews(data as any);
    if (error) console.error(error);
    setLoadingReviews(false);
  };

  const openReviews = (hotel: PetHotel) => {
    setReviewHotel(hotel);
    setShowReviewForm(false);
    fetchReviews(hotel.id);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (reviewImages.length + files.length > 9) {
      toast.error("最多上传9张图片");
      return;
    }
    const newFiles = [...reviewImages, ...files].slice(0, 9);
    setReviewImages(newFiles);
    setReviewPreviews(newFiles.map((f) => URL.createObjectURL(f)));
  };

  const removeImage = (idx: number) => {
    const newFiles = reviewImages.filter((_, i) => i !== idx);
    setReviewImages(newFiles);
    setReviewPreviews(newFiles.map((f) => URL.createObjectURL(f)));
  };

  const submitReview = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!reviewHotel) return;
    if (!reviewContent.trim()) { toast.error("请输入评价内容"); return; }

    setSubmittingReview(true);
    try {
      // Upload images
      const imageUrls: string[] = [];
      for (const file of reviewImages) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("hotel-review-images")
          .upload(path, file);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage
          .from("hotel-review-images")
          .getPublicUrl(path);
        imageUrls.push(urlData.publicUrl);
      }

      const { error } = await supabase.from("hotel_reviews" as any).insert({
        hotel_id: reviewHotel.id,
        user_id: user.id,
        rating: reviewRating,
        content: reviewContent,
        images: imageUrls,
      });
      if (error) throw error;

      toast.success("评价发表成功！");
      setShowReviewForm(false);
      setReviewContent("");
      setReviewRating(5);
      setReviewImages([]);
      setReviewPreviews([]);
      fetchReviews(reviewHotel.id);
    } catch (err: any) {
      toast.error(err.message || "评价失败");
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-secondary transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-extrabold text-foreground flex items-center gap-2">
            <Hotel className="w-5 h-5 text-primary" /> 宠物友好酒店
          </h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto">
        {/* Search */}
        <div className="px-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索酒店名称、标签..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-secondary text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
        </div>

        {/* Map */}
        <div className="px-4 mt-4">
          <div ref={mapRef} className="rounded-xl overflow-hidden border border-border" style={{ height: 220 }} />
          {currentLocation && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <LocateFixed className="w-3.5 h-3.5 text-primary" />
              <span className="truncate">当前位置：{currentLocation}</span>
            </div>
          )}
        </div>

        {/* Route Info */}
        {routeInfo && selectedHotel && (
          <div className="px-4 mt-3">
            <Card className="border-primary/20" style={{ backgroundColor: "hsl(var(--primary) / 0.05)" }}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-xs font-bold text-foreground">到 {selectedHotel.name.slice(0, 8)}...</p>
                    <p className="text-[10px] text-muted-foreground">{routeInfo.distance} · 约{routeInfo.duration}</p>
                  </div>
                </div>
                <Button size="sm" variant="default" onClick={() => setBookingHotel(selectedHotel)}>
                  立即预订
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Hotel List */}
        <div className="px-4 mt-4 space-y-3 pb-4">
          <h2 className="text-base font-extrabold text-foreground">📍 附近宠物友好酒店</h2>

          {loadingHotels ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}><CardContent className="p-0 flex">
                <Skeleton className="w-24 h-28 shrink-0" />
                <div className="flex-1 p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-5 w-1/3" />
                </div>
              </CardContent></Card>
            ))
          ) : filteredHotels.map((hotel) => (
            <Card
              key={hotel.id}
              className={cn(
                "overflow-hidden cursor-pointer transition-all hover:card-shadow-hover",
                selectedHotel?.id === hotel.id && "ring-2 ring-primary"
              )}
              onClick={() => planRouteToHotel(hotel)}
            >
              <CardContent className="p-0">
                <div className="flex">
                  <div className="w-24 h-28 bg-secondary flex items-center justify-center text-4xl shrink-0">
                    {hotel.image_url || "🏨"}
                  </div>
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="text-sm font-bold text-foreground line-clamp-1">{hotel.name}</h3>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span className="text-xs font-bold text-foreground">{Number(hotel.rating).toFixed(1)}</span>
                      <span className="text-[10px] text-muted-foreground">({hotel.reviews_count}条评价)</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground truncate">{hotel.address}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {hotel.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-extrabold text-primary">¥{hotel.price_min}-{hotel.price_max}/晚</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); openReviews(hotel); }}
                          className="p-1 rounded-lg hover:bg-secondary"
                          title="查看评价"
                        >
                          <MessageSquare className="w-4 h-4 text-primary" />
                        </button>
                        <a href={`tel:${hotel.phone}`} onClick={(e) => e.stopPropagation()} className="p-1 rounded-lg hover:bg-secondary">
                          <Phone className="w-4 h-4 text-primary" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Selected Hotel Detail */}
        {selectedHotel && !bookingHotel && !reviewHotel && (
          <div className="px-4 pb-6">
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                  <PawPrint className="w-4 h-4 text-primary" /> {selectedHotel.name}
                </h3>
                {selectedHotel.description && (
                  <p className="text-xs text-muted-foreground">{selectedHotel.description}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {selectedHotel.amenities.map((a) => (
                    <div key={a} className="flex items-center gap-1.5 text-xs text-foreground bg-secondary rounded-lg px-2.5 py-2">
                      <Wifi className="w-3.5 h-3.5 text-primary" />
                      {a}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openReviews(selectedHotel)}>
                    <MessageSquare className="w-4 h-4 mr-1" /> 查看评价
                  </Button>
                  <Button variant="hero" size="sm" className="flex-1" onClick={() => setBookingHotel(selectedHotel)}>
                    立即预订
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Booking Modal */}
        {bookingHotel && (
          <div className="fixed inset-0 z-50 bg-foreground/50 flex items-end justify-center" onClick={() => setBookingHotel(null)}>
            <div className="bg-background w-full max-w-lg rounded-t-2xl p-5 space-y-4 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" /> 预订 {bookingHotel.name}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1 block">入住日期</label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                  />
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
                    <span className="text-foreground">¥{bookingHotel.price_min}/晚 × {bookingNights}晚</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold border-t border-border pt-2 mt-2">
                    <span className="text-foreground">合计</span>
                    <span className="text-primary">¥{bookingHotel.price_min * bookingNights}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setBookingHotel(null)}>取消</Button>
                <Button variant="hero" className="flex-1" onClick={handleBooking} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  确认预订
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Reviews Panel */}
        {reviewHotel && (
          <div className="fixed inset-0 z-50 bg-foreground/50 flex items-end justify-center" onClick={() => { setReviewHotel(null); setShowReviewForm(false); }}>
            <div
              className="bg-background w-full max-w-lg rounded-t-2xl max-h-[80vh] flex flex-col animate-fade-in-up"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  {reviewHotel.name} 的评价
                </h3>
                <button onClick={() => { setReviewHotel(null); setShowReviewForm(false); }} className="p-1 rounded-lg hover:bg-secondary">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {showReviewForm ? (
                  /* Review Form */
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-foreground mb-2 block">评分</label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button key={s} onClick={() => setReviewRating(s)}>
                            <Star className={cn("w-7 h-7 transition-colors", s <= reviewRating ? "text-amber-500 fill-amber-500" : "text-muted-foreground")} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-foreground mb-1 block">评价内容</label>
                      <Textarea
                        value={reviewContent}
                        onChange={(e) => setReviewContent(e.target.value)}
                        placeholder="分享您和毛孩子的入住体验..."
                        className="min-h-[100px] rounded-xl bg-secondary border-none"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-foreground mb-2 block">上传图片 ({reviewImages.length}/9)</label>
                      <div className="flex flex-wrap gap-2">
                        {reviewPreviews.map((src, idx) => (
                          <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden">
                            <img src={src} alt="" className="w-full h-full object-cover" />
                            <button
                              onClick={() => removeImage(idx)}
                              className="absolute top-0.5 right-0.5 bg-foreground/60 text-background rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {reviewImages.length < 9 && (
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-20 h-20 rounded-lg bg-secondary border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-primary transition-colors"
                          >
                            <Camera className="w-5 h-5 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">添加</span>
                          </button>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImageSelect}
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={() => setShowReviewForm(false)}>取消</Button>
                      <Button variant="hero" className="flex-1" onClick={submitReview} disabled={submittingReview}>
                        {submittingReview ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                        发表评价
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Review List */
                  <>
                    <Button
                      variant="warm"
                      className="w-full"
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
                          <div className="flex items-center gap-2">
                            <Skeleton className="w-8 h-8 rounded-full" />
                            <Skeleton className="h-4 w-20" />
                          </div>
                          <Skeleton className="h-12 w-full" />
                        </div>
                      ))
                    ) : reviews.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">暂无评价，来做第一个评价的人吧！</p>
                      </div>
                    ) : (
                      reviews.map((review) => (
                        <Card key={review.id} className="overflow-hidden">
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                  {(review.profiles as any)?.username?.charAt(0) || "U"}
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-foreground">{(review.profiles as any)?.username || "用户"}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {new Date(review.created_at).toLocaleDateString("zh-CN")}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star key={s} className={cn("w-3 h-3", s <= review.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30")} />
                                ))}
                              </div>
                            </div>
                            {review.content && (
                              <p className="text-xs text-foreground leading-relaxed">{review.content}</p>
                            )}
                            {review.images && review.images.length > 0 && (
                              <div className="flex gap-1.5 flex-wrap">
                                {review.images.map((img, idx) => (
                                  <img key={idx} src={img} alt="" className="w-16 h-16 rounded-lg object-cover" />
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default PetHotelPage;
