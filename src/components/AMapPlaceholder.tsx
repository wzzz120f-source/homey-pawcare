import { useState } from "react";
import { MapPin, Navigation, Search, LocateFixed, Route, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AMapPlaceholderProps {
  pickupAddress: string;
  onPickupAddressChange: (addr: string) => void;
  dropoffAddress: string;
  onDropoffAddressChange: (addr: string) => void;
}

const suggestedAddresses = [
  { name: "我的家", address: "浦东新区张杨路500号", tag: "常用" },
  { name: "萌宠乐园·浦东店", address: "浦东新区陆家嘴环路100号", tag: "门店" },
  { name: "爱宠之家·陆家嘴店", address: "浦东新区东方路300号", tag: "门店" },
];

const AMapPlaceholder = ({
  pickupAddress,
  onPickupAddressChange,
  dropoffAddress,
  onDropoffAddressChange,
}: AMapPlaceholderProps) => {
  const [focusedInput, setFocusedInput] = useState<"pickup" | "dropoff" | null>(null);
  const [showRoute, setShowRoute] = useState(false);

  const handleSelectAddress = (address: string) => {
    if (focusedInput === "pickup") {
      onPickupAddressChange(address);
    } else if (focusedInput === "dropoff") {
      onDropoffAddressChange(address);
    }
    setFocusedInput(null);
    if (pickupAddress && dropoffAddress) {
      setShowRoute(true);
    }
  };

  const handleConfirmRoute = () => {
    if (pickupAddress && dropoffAddress) {
      setShowRoute(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Address Inputs */}
      <div className="bg-card rounded-xl p-4 card-shadow space-y-3">
        {/* Pickup */}
        <div>
          <label className="text-xs font-semibold text-primary mb-1.5 flex items-center gap-1 uppercase tracking-wide">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            取宠地址
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={pickupAddress}
              onChange={(e) => onPickupAddressChange(e.target.value)}
              onFocus={() => setFocusedInput("pickup")}
              placeholder="输入取宠地址或点击地图选点"
              className="w-full pl-9 pr-10 py-2.5 rounded-lg bg-secondary text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary transition-all"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted transition-colors" title="使用当前定位">
              <LocateFixed className="w-4 h-4 text-primary" />
            </button>
          </div>
        </div>

        {/* Route line connector */}
        <div className="flex items-center gap-3 pl-1">
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-0.5 h-2 bg-border" />
            <div className="w-0.5 h-2 bg-border" />
            <div className="w-0.5 h-2 bg-border" />
          </div>
          <div className="flex-1 border-t border-dashed border-border" />
        </div>

        {/* Dropoff */}
        <div>
          <label className="text-xs font-semibold text-destructive mb-1.5 flex items-center gap-1 uppercase tracking-wide">
            <div className="w-2 h-2 rounded-full bg-destructive" />
            送达地址
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={dropoffAddress}
              onChange={(e) => onDropoffAddressChange(e.target.value)}
              onFocus={() => setFocusedInput("dropoff")}
              placeholder="输入送达地址（门店/家庭）"
              className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-secondary text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
        </div>
      </div>

      {/* Address Suggestions Dropdown */}
      {focusedInput && (
        <div className="bg-card rounded-xl card-shadow overflow-hidden animate-fade-in-up">
          <div className="px-4 py-2 border-b border-border/50">
            <p className="text-xs font-semibold text-muted-foreground">推荐地址</p>
          </div>
          {suggestedAddresses.map((item) => (
            <button
              key={item.name}
              onClick={() => handleSelectAddress(item.address)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors text-left"
            >
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{item.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{item.tag}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{item.address}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Map Placeholder */}
      <div className="rounded-xl overflow-hidden border border-border bg-muted relative" style={{ height: 220 }}>
        {/* Simulated map grid */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-foreground" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Simulated road lines */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 220">
          <path d="M 0 110 Q 100 80 200 110 T 400 100" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" opacity="0.2" strokeDasharray="8 4" />
          <path d="M 80 0 Q 100 110 120 220" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2" opacity="0.15" />
          <path d="M 300 0 Q 280 110 260 220" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2" opacity="0.15" />
        </svg>

        {showRoute && pickupAddress && dropoffAddress ? (
          <>
            {/* Route line */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 220">
              <path
                d="M 80 160 Q 150 60 320 80"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="3"
                strokeLinecap="round"
                className="animate-pulse"
              />
            </svg>
            {/* Start marker */}
            <div className="absolute left-[18%] top-[68%] -translate-x-1/2 -translate-y-full">
              <div className="flex flex-col items-center">
                <div className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold mb-1 shadow-md whitespace-nowrap">取宠点</div>
                <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-lg" />
              </div>
            </div>
            {/* End marker */}
            <div className="absolute left-[78%] top-[32%] -translate-x-1/2 -translate-y-full">
              <div className="flex flex-col items-center">
                <div className="bg-destructive text-white text-[10px] px-2 py-0.5 rounded-full font-bold mb-1 shadow-md whitespace-nowrap">送达点</div>
                <div className="w-3 h-3 bg-destructive rounded-full border-2 border-white shadow-lg" />
              </div>
            </div>
            {/* Route info */}
            <div className="absolute bottom-3 left-3 right-3 bg-card/95 backdrop-blur-sm rounded-lg p-3 shadow-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs font-bold text-foreground">预计路程 5.2 公里</p>
                  <p className="text-[10px] text-muted-foreground">预计用时 18 分钟</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-extrabold text-primary">¥25</p>
                <p className="text-[10px] text-muted-foreground">接送费</p>
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Navigation className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm font-bold text-foreground">高德地图</p>
            <p className="text-xs text-muted-foreground mt-1">输入取宠和送达地址后显示路线</p>
            <p className="text-[10px] text-muted-foreground/60 mt-2">接入 API Key 后将显示真实地图</p>
          </div>
        )}
      </div>

      {/* Pickup options */}
      <div className="bg-card rounded-xl p-4 card-shadow space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          🚗 接送方式
        </h3>
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

      {/* Confirm route button */}
      {pickupAddress && dropoffAddress && !showRoute && (
        <Button variant="warm" size="lg" className="w-full" onClick={handleConfirmRoute}>
          <Route className="w-4 h-4 mr-2" />
          查看路线规划
        </Button>
      )}
    </div>
  );
};

export default AMapPlaceholder;
