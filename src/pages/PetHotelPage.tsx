import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AMapLoader from "@amap/amap-jsapi-loader";
import { ArrowLeft, Search, Star, MapPin, Phone, LocateFixed, Hotel, PawPrint, Car, Loader2, MessageSquare, SlidersHorizontal, ArrowUpDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BottomNav from "@/components/BottomNav";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

import hotelDogFriendly from "@/assets/hotel-dog-friendly.jpg";
import hotelCatFriendly from "@/assets/hotel-cat-friendly.jpg";
import hotelPetSpa from "@/assets/hotel-pet-spa.jpg";
import hotelLuxury from "@/assets/hotel-luxury.jpg";
import hotelGarden from "@/assets/hotel-garden.jpg";
import hotelBudget from "@/assets/hotel-budget.jpg";

const ALL_IMAGES = [hotelDogFriendly, hotelCatFriendly, hotelPetSpa, hotelLuxury, hotelGarden, hotelBudget];
const getHotelImage = (hotel: { name: string; image_url: string | null }, index: number): string => {
  if (hotel.image_url?.startsWith("http")) return hotel.image_url;
  if (hotel.name.includes("猫")) return hotelCatFriendly;
  if (hotel.name.includes("皇家")) return hotelLuxury;
  if (hotel.name.includes("乐园")) return hotelGarden;
  if (hotel.name.includes("友汇")) return hotelBudget;
  return ALL_IMAGES[index % ALL_IMAGES.length];
};

declare global {
  interface Window { AMap: any; _AMapSecurityConfig: any; }
}

const AMAP_KEY = "f1be18c642140d1114b326946ab357cc";
const AMAP_SECURITY_KEY = "99a72147fee06b466b18e76ded5cc55c";

const PRICE_RANGES = [
  { label: "全部", min: 0, max: 99999 },
  { label: "¥200以下", min: 0, max: 200 },
  { label: "¥200-400", min: 200, max: 400 },
  { label: "¥400-600", min: 400, max: 600 },
  { label: "¥600以上", min: 600, max: 99999 },
];

type SortType = "rating" | "price_low" | "price_high" | "reviews";

interface PetHotel {
  id: string; name: string; address: string; longitude: number; latitude: number;
  rating: number; reviews_count: number; price_min: number; price_max: number;
  tags: string[]; amenities: string[]; phone: string | null;
  image_url: string | null; description: string | null;
}

const PetHotelPage = () => {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [hotels, setHotels] = useState<PetHotel[]>([]);
  const [loadingHotels, setLoadingHotels] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHotel, setSelectedHotel] = useState<PetHotel | null>(null);
  const [currentLocation, setCurrentLocation] = useState("");
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [sortType, setSortType] = useState<SortType>("rating");
  const [priceRange, setPriceRange] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    supabase.from("pet_hotels" as any).select("*").eq("is_active", true)
      .order("rating", { ascending: false })
      .then(({ data, error }) => {
        if (data) setHotels(data as any);
        if (error) console.error(error);
        setLoadingHotels(false);
      });
  }, []);

  useEffect(() => {
    if (window.AMap) { setLoaded(true); return; }
    window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_KEY };
    AMapLoader.load({
      key: AMAP_KEY,
      version: "2.0",
      plugins: ["AMap.Geolocation", "AMap.Geocoder", "AMap.Driving"],
    })
      .then((AMap) => {
        window.AMap = AMap;
        setLoaded(true);
      })
      .catch((e) => console.error("[AMap] 加载失败", e));
  }, []);

  useEffect(() => {
    if (!loaded || !mapRef.current || mapInstance.current || hotels.length === 0) return;
    const map = new window.AMap.Map(mapRef.current, {
      zoom: 12, center: [121.47, 31.23], mapStyle: "amap://styles/light",
    });
    mapInstance.current = map;
    hotels.forEach(h => {
      const marker = new window.AMap.Marker({
        position: [h.longitude, h.latitude], title: h.name,
        label: { content: `<span style="font-size:11px;background:#fff;padding:2px 6px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.15)">🏨 ${h.name.slice(0, 6)}</span>`, direction: "top" },
      });
      marker.on("click", () => { setSelectedHotel(h); planRouteToHotel(h, map); });
      map.add(marker);
    });
    const geo = new window.AMap.Geolocation({ enableHighAccuracy: true, timeout: 10000 });
    map.addControl(geo);
    geo.getCurrentPosition((status: string, result: any) => {
      if (status === "complete") {
        const { lng, lat } = result.position;
        new window.AMap.Geocoder().getAddress([lng, lat], (s: string, r: any) => {
          if (s === "complete" && r.regeocode) setCurrentLocation(r.regeocode.formattedAddress);
        });
      }
    });
  }, [loaded, hotels]);

  const planRouteToHotel = (hotel: PetHotel, map?: any) => {
    const m = map || mapInstance.current;
    if (!loaded || !m) return;
    setSelectedHotel(hotel);
    setRouteInfo(null);
    const startAddr = currentLocation || "上海市浦东新区张杨路500号";
    new window.AMap.Geocoder().getLocation(startAddr, (s: string, r: any) => {
      if (s !== "complete" || !r.geocodes[0]) return;
      const start = r.geocodes[0].location;
      m.clearMap();
      hotels.forEach(h => m.add(new window.AMap.Marker({ position: [h.longitude, h.latitude], title: h.name })));
      new window.AMap.Driving({ map: m }).search(start, new window.AMap.LngLat(hotel.longitude, hotel.latitude), (status: string, result: any) => {
        if (status === "complete" && result.routes?.length > 0) {
          const route = result.routes[0];
          setRouteInfo({ distance: `${(route.distance / 1000).toFixed(1)}公里`, duration: `${Math.ceil(route.time / 60)}分钟` });
        }
      });
    });
  };

  // Filter & sort
  const range = PRICE_RANGES[priceRange];
  const filteredHotels = hotels
    .filter(h => (!searchQuery || h.name.includes(searchQuery) || h.tags.some(t => t.includes(searchQuery))))
    .filter(h => h.price_min >= range.min && h.price_min <= range.max)
    .sort((a, b) => {
      switch (sortType) {
        case "price_low": return a.price_min - b.price_min;
        case "price_high": return b.price_min - a.price_min;
        case "reviews": return b.reviews_count - a.reviews_count;
        default: return Number(b.rating) - Number(a.rating);
      }
    });

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 rounded-lg hover:bg-secondary" aria-label="返回">
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
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索酒店名称、标签..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-secondary text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-4 mt-3 flex items-center gap-2">
          <button onClick={() => setShowFilters(!showFilters)}
            className={cn("flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              showFilters ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-foreground border-border")}>
            <SlidersHorizontal className="w-3.5 h-3.5" /> 筛选
          </button>
          <Select value={sortType} onValueChange={(v) => setSortType(v as SortType)}>
            <SelectTrigger className="h-8 w-auto min-w-[100px] rounded-full text-xs border-border bg-secondary">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">评分最高</SelectItem>
              <SelectItem value="price_low">价格最低</SelectItem>
              <SelectItem value="price_high">价格最高</SelectItem>
              <SelectItem value="reviews">评价最多</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">{filteredHotels.length}家酒店</span>
        </div>

        {/* Price Range Filter */}
        {showFilters && (
          <div className="px-4 mt-2">
            <div className="bg-secondary rounded-xl p-3">
              <p className="text-xs font-semibold text-foreground mb-2">价格区间</p>
              <div className="flex flex-wrap gap-2">
                {PRICE_RANGES.map((r, i) => (
                  <button key={i} onClick={() => setPriceRange(i)}
                    className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                      priceRange === i ? "bg-primary text-primary-foreground" : "bg-background text-foreground border border-border")}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Map */}
        <div className="px-4 mt-3">
          <div ref={mapRef} className="rounded-xl overflow-hidden border border-border" style={{ height: 200 }} />
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
                <Button size="sm" onClick={() => navigate(`/pet-hotel/${selectedHotel.id}`)}>
                  查看详情
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
                <Skeleton className="w-28 h-32 shrink-0" />
                <div className="flex-1 p-3 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-full" /><Skeleton className="h-5 w-1/3" /></div>
              </CardContent></Card>
            ))
          ) : filteredHotels.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Hotel className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">没有找到符合条件的酒店</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSearchQuery(""); setPriceRange(0); }}>清除筛选</Button>
            </div>
          ) : filteredHotels.map((hotel, index) => (
            <Card key={hotel.id}
              className={cn("overflow-hidden cursor-pointer transition-all hover:shadow-md", selectedHotel?.id === hotel.id && "ring-2 ring-primary")}
              onClick={() => navigate(`/pet-hotel/${hotel.id}`)}
            >
              <CardContent className="p-0">
                <div className="flex">
                  <div className="w-28 h-32 bg-secondary shrink-0 overflow-hidden">
                    <img src={getHotelImage(hotel, index)} alt={hotel.name}
                      className="w-full h-full object-cover" loading="lazy" width={112} height={128} />
                  </div>
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="text-sm font-bold text-foreground line-clamp-1">{hotel.name}</h3>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span className="text-xs font-bold text-foreground">{Number(hotel.rating).toFixed(1)}</span>
                      <span className="text-[10px] text-muted-foreground">({hotel.reviews_count}条评价)</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-[10px] text-muted-foreground truncate">{hotel.address}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {hotel.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-extrabold text-primary">¥{hotel.price_min}<span className="text-[10px] font-normal text-muted-foreground">起/晚</span></span>
                      <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                        {hotel.phone && (
                          <a href={`tel:${hotel.phone}`}
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-secondary" aria-label="拨打电话">
                            <Phone className="w-4 h-4 text-primary" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default PetHotelPage;
