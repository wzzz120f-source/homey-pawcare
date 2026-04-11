import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Star, MapPin, Phone, LocateFixed, Hotel, Wifi, PawPrint, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BottomNav from "@/components/BottomNav";
import { cn } from "@/lib/utils";

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
  distance: string;
  rating: number;
  reviews: number;
  priceRange: string;
  tags: string[];
  phone: string;
  image: string;
  amenities: string[];
  location?: [number, number];
}

const MOCK_HOTELS: PetHotel[] = [
  {
    id: "h1", name: "汪星人友好酒店·浦东店", address: "浦东新区陆家嘴环路1000号",
    distance: "1.2km", rating: 4.9, reviews: 328, priceRange: "¥388-688/晚",
    tags: ["可带大型犬", "宠物泳池", "24h看护"], phone: "021-58881234",
    image: "🏨", amenities: ["宠物泳池", "专属遛狗区", "宠物SPA", "24h监控"],
    location: [121.5018, 31.2397],
  },
  {
    id: "h2", name: "喵星球精品民宿", address: "浦东新区世纪大道200号",
    distance: "2.0km", rating: 4.8, reviews: 215, priceRange: "¥268-528/晚",
    tags: ["猫咪友好", "独立猫房", "有机猫粮"], phone: "021-58765432",
    image: "🐱", amenities: ["独立猫房", "猫爬架", "有机食品", "安静环境"],
    location: [121.5133, 31.2335],
  },
  {
    id: "h3", name: "萌宠度假村·世纪公园", address: "浦东新区锦绣路1001号",
    distance: "3.1km", rating: 4.7, reviews: 186, priceRange: "¥198-458/晚",
    tags: ["花园庭院", "多宠同住", "接送服务"], phone: "021-68901234",
    image: "🌳", amenities: ["大花园", "接送服务", "宠物摄影", "训练课程"],
    location: [121.5445, 31.2168],
  },
  {
    id: "h4", name: "爱宠之家·陆家嘴旗舰店", address: "浦东新区东方路500号",
    distance: "1.8km", rating: 4.6, reviews: 142, priceRange: "¥158-388/晚",
    tags: ["经济实惠", "宠物美容", "寄养托管"], phone: "021-50987654",
    image: "🏠", amenities: ["寄养托管", "美容服务", "训练课程", "宠物用品"],
    location: [121.5228, 31.2290],
  },
];

const PetHotelPage = () => {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHotel, setSelectedHotel] = useState<PetHotel | null>(null);
  const [currentLocation, setCurrentLocation] = useState("");
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);

  // Load AMap SDK
  useEffect(() => {
    if (window.AMap) { setLoaded(true); return; }
    window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_KEY };
    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.Geolocation,AMap.Geocoder,AMap.AutoComplete,AMap.Driving`;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Init map & markers
  useEffect(() => {
    if (!loaded || !mapRef.current || mapInstance.current) return;
    const map = new window.AMap.Map(mapRef.current, {
      zoom: 13,
      center: [121.5018, 31.2304],
      mapStyle: "amap://styles/light",
    });
    mapInstance.current = map;

    // Add hotel markers
    MOCK_HOTELS.forEach((h) => {
      if (!h.location) return;
      const marker = new window.AMap.Marker({
        position: h.location,
        title: h.name,
        label: { content: `<span style="font-size:12px;background:#fff;padding:2px 6px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.15)">${h.image} ${h.name.slice(0, 6)}</span>`, direction: "top" },
      });
      marker.on("click", () => setSelectedHotel(h));
      map.add(marker);
    });

    // Get current location
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
  }, [loaded]);

  const filteredHotels = MOCK_HOTELS.filter((h) =>
    !searchQuery || h.name.includes(searchQuery) || h.tags.some((t) => t.includes(searchQuery))
  );

  const planRouteToHotel = (hotel: PetHotel) => {
    if (!loaded || !mapInstance.current || !hotel.location) return;
    setSelectedHotel(hotel);

    const geocoder = new window.AMap.Geocoder();
    const startAddr = currentLocation || "上海市浦东新区张杨路500号";
    geocoder.getLocation(startAddr, (s: string, r: any) => {
      if (s !== "complete" || !r.geocodes[0]) return;
      const start = r.geocodes[0].location;
      mapInstance.current.clearMap();

      // Re-add markers
      MOCK_HOTELS.forEach((h) => {
        if (!h.location) return;
        const marker = new window.AMap.Marker({ position: h.location, title: h.name });
        mapInstance.current.add(marker);
      });

      const driving = new window.AMap.Driving({ map: mapInstance.current });
      driving.search(start, new window.AMap.LngLat(hotel.location[0], hotel.location[1]), (status: string, result: any) => {
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
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-xs font-bold text-foreground">到 {selectedHotel.name.slice(0, 8)}...</p>
                    <p className="text-[10px] text-muted-foreground">{routeInfo.distance} · 约{routeInfo.duration}</p>
                  </div>
                </div>
                <Button size="sm" variant="default" onClick={() => navigate("/booking")}>
                  预约接送
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Hotel List */}
        <div className="px-4 mt-4 space-y-3 pb-4">
          <h2 className="text-base font-extrabold text-foreground">📍 附近宠物友好酒店</h2>
          {filteredHotels.map((hotel) => (
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
                    {hotel.image}
                  </div>
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="text-sm font-bold text-foreground line-clamp-1">{hotel.name}</h3>
                      <span className="text-xs text-muted-foreground shrink-0">{hotel.distance}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span className="text-xs font-bold text-foreground">{hotel.rating}</span>
                      <span className="text-[10px] text-muted-foreground">({hotel.reviews}条评价)</span>
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
                      <span className="text-sm font-extrabold text-primary">{hotel.priceRange}</span>
                      <a href={`tel:${hotel.phone}`} onClick={(e) => e.stopPropagation()} className="p-1 rounded-lg hover:bg-secondary">
                        <Phone className="w-4 h-4 text-primary" />
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Selected Hotel Detail */}
        {selectedHotel && (
          <div className="px-4 pb-6">
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                  <PawPrint className="w-4 h-4 text-primary" /> {selectedHotel.name}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {selectedHotel.amenities.map((a) => (
                    <div key={a} className="flex items-center gap-1.5 text-xs text-foreground bg-secondary rounded-lg px-2.5 py-2">
                      <Wifi className="w-3.5 h-3.5 text-primary" />
                      {a}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => window.open(`tel:${selectedHotel.phone}`)}>
                    <Phone className="w-4 h-4 mr-1" /> 电话咨询
                  </Button>
                  <Button variant="hero" size="sm" className="flex-1" onClick={() => navigate("/booking")}>
                    立即预订
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default PetHotelPage;
