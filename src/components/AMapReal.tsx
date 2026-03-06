import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Search, LocateFixed, Route } from "lucide-react";

interface AMapRealProps {
  pickupAddress: string;
  onPickupAddressChange: (addr: string) => void;
  dropoffAddress: string;
  onDropoffAddressChange: (addr: string) => void;
}

declare global {
  interface Window {
    AMap: any;
    _AMapSecurityConfig: any;
  }
}

const AMAP_KEY = "f1be18c642140d1114b326946ab357cc";
const AMAP_SECURITY_KEY = "99a72147fee06b466b18e76ded5cc55c";

const AMapReal = ({
  pickupAddress,
  onPickupAddressChange,
  dropoffAddress,
  onDropoffAddressChange,
}: AMapRealProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string>("");
  const [focusedInput, setFocusedInput] = useState<"pickup" | "dropoff" | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string; fee: number } | null>(null);

  // Load AMap SDK
  useEffect(() => {
    if (window.AMap) { setLoaded(true); return; }

    window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_KEY };

    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.Geolocation,AMap.Geocoder,AMap.AutoComplete,AMap.Driving`;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);

    return () => { document.head.removeChild(script); };
  }, []);

  // Init map
  useEffect(() => {
    if (!loaded || !mapRef.current || mapInstance.current) return;
    const map = new window.AMap.Map(mapRef.current, {
      zoom: 14,
      center: [121.4737, 31.2304], // Shanghai default
      mapStyle: "amap://styles/light",
    });
    mapInstance.current = map;

    // Get current location
    const geo = new window.AMap.Geolocation({
      enableHighAccuracy: true,
      timeout: 10000,
    });
    map.addControl(geo);
    geo.getCurrentPosition((status: string, result: any) => {
      if (status === "complete") {
        const { lng, lat } = result.position;
        const geocoder = new window.AMap.Geocoder();
        geocoder.getAddress([lng, lat], (s: string, r: any) => {
          if (s === "complete" && r.regeocode) {
            const addr = r.regeocode.formattedAddress;
            setCurrentLocation(addr);
          }
        });
      }
    });
  }, [loaded]);

  // Autocomplete search
  useEffect(() => {
    if (!loaded || !focusedInput) { setSuggestions([]); return; }
    const query = focusedInput === "pickup" ? pickupAddress : dropoffAddress;
    if (!query || query.length < 2) { setSuggestions([]); return; }

    const auto = new window.AMap.AutoComplete({ city: "上海" });
    auto.search(query, (status: string, result: any) => {
      if (status === "complete" && result.tips) {
        setSuggestions(result.tips.filter((t: any) => t.location).slice(0, 5));
      }
    });
  }, [pickupAddress, dropoffAddress, focusedInput, loaded]);

  const handleSelectSuggestion = (tip: any) => {
    const addr = tip.district + tip.name;
    if (focusedInput === "pickup") onPickupAddressChange(addr);
    else if (focusedInput === "dropoff") onDropoffAddressChange(addr);
    setFocusedInput(null);
    setSuggestions([]);
  };

  const useCurrentLocation = () => {
    if (currentLocation) {
      onPickupAddressChange(currentLocation);
    }
  };

  // Plan route
  const planRoute = () => {
    if (!loaded || !pickupAddress || !dropoffAddress || !mapInstance.current) return;

    const geocoder = new window.AMap.Geocoder();
    geocoder.getLocation(pickupAddress, (s1: string, r1: any) => {
      if (s1 !== "complete" || !r1.geocodes[0]) return;
      const start = r1.geocodes[0].location;

      geocoder.getLocation(dropoffAddress, (s2: string, r2: any) => {
        if (s2 !== "complete" || !r2.geocodes[0]) return;
        const end = r2.geocodes[0].location;

        mapInstance.current.clearMap();

        const driving = new window.AMap.Driving({ map: mapInstance.current });
        driving.search(start, end, (status: string, result: any) => {
          if (status === "complete" && result.routes?.length > 0) {
            const route = result.routes[0];
            const distKm = (route.distance / 1000).toFixed(1);
            const durMin = Math.ceil(route.time / 60);
            const fee = Math.max(15, Math.round(route.distance / 1000 * 5));
            setRouteInfo({ distance: `${distKm}公里`, duration: `${durMin}分钟`, fee });
          }
        });
      });
    });
  };

  return (
    <div className="space-y-4">
      {/* Address Inputs */}
      <div className="bg-card rounded-xl p-4 card-shadow space-y-3">
        <div>
          <label className="text-xs font-semibold text-primary mb-1.5 flex items-center gap-1 uppercase tracking-wide">
            <div className="w-2 h-2 rounded-full bg-green-500" /> 取宠地址
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={pickupAddress}
              onChange={(e) => onPickupAddressChange(e.target.value)}
              onFocus={() => setFocusedInput("pickup")}
              placeholder="输入取宠地址"
              className="w-full pl-9 pr-10 py-2.5 rounded-lg bg-secondary text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary transition-all"
            />
            <button onClick={useCurrentLocation} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted transition-colors" title="使用当前定位">
              <LocateFixed className="w-4 h-4 text-primary" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 pl-1">
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-0.5 h-2 bg-border" />
            <div className="w-0.5 h-2 bg-border" />
            <div className="w-0.5 h-2 bg-border" />
          </div>
          <div className="flex-1 border-t border-dashed border-border" />
        </div>

        <div>
          <label className="text-xs font-semibold text-destructive mb-1.5 flex items-center gap-1 uppercase tracking-wide">
            <div className="w-2 h-2 rounded-full bg-destructive" /> 送达地址
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={dropoffAddress}
              onChange={(e) => onDropoffAddressChange(e.target.value)}
              onFocus={() => setFocusedInput("dropoff")}
              placeholder="输入送达地址"
              className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-secondary text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
        </div>
      </div>

      {/* Autocomplete Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-card rounded-xl card-shadow overflow-hidden animate-fade-in-up">
          <div className="px-4 py-2 border-b border-border/50">
            <p className="text-xs font-semibold text-muted-foreground">搜索结果</p>
          </div>
          {suggestions.map((tip, i) => (
            <button
              key={i}
              onClick={() => handleSelectSuggestion(tip)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors text-left"
            >
              <LocateFixed className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{tip.name}</p>
                <p className="text-xs text-muted-foreground truncate">{tip.district}{tip.address}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Map */}
      <div
        ref={mapRef}
        className="rounded-xl overflow-hidden border border-border"
        style={{ height: 250 }}
      />

      {/* Route info */}
      {routeInfo && (
        <div className="bg-card rounded-xl p-4 card-shadow flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-primary" />
            <div>
              <p className="text-xs font-bold text-foreground">预计路程 {routeInfo.distance}</p>
              <p className="text-[10px] text-muted-foreground">预计用时 {routeInfo.duration}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-extrabold text-primary">¥{routeInfo.fee}</p>
            <p className="text-[10px] text-muted-foreground">接送费</p>
          </div>
        </div>
      )}

      {/* Plan route button */}
      {pickupAddress && dropoffAddress && (
        <Button variant="warm" size="lg" className="w-full" onClick={planRoute}>
          <Route className="w-4 h-4 mr-2" /> 查看路线规划
        </Button>
      )}

      {/* Pickup options */}
      <div className="bg-card rounded-xl p-4 card-shadow space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">🚗 接送方式</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "专车接送", desc: "司机上门接宠", price: "¥25起", emoji: "🚙" },
            { label: "顺路拼单", desc: "与其他宠物同行", price: "¥15起", emoji: "🚐" },
          ].map((option) => (
            <button
              key={option.label}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-secondary hover:bg-muted transition-all text-center"
            >
              <span className="text-2xl">{option.emoji}</span>
              <span className="text-sm font-bold text-foreground">{option.label}</span>
              <span className="text-[10px] text-muted-foreground">{option.desc}</span>
              <span className="text-xs font-bold text-primary mt-1">{option.price}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AMapReal;
