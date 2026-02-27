import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, MapPin, PawPrint, FileText, Car, Building2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import BottomNav from "@/components/BottomNav";

const petTypes = [
  { id: "dog-small", emoji: "🐶", label: "小型犬" },
  { id: "dog-medium", emoji: "🐕", label: "中型犬" },
  { id: "dog-large", emoji: "🦮", label: "大型犬" },
  { id: "cat", emoji: "🐱", label: "猫咪" },
  { id: "rabbit", emoji: "🐰", label: "兔子" },
  { id: "other", emoji: "🐾", label: "其他" },
];

const serviceTypes = [
  { id: "bath", label: "洗澡 SPA", price: "¥89起", icon: "🛁" },
  { id: "grooming", label: "美容造型", price: "¥128起", icon: "✂️" },
  { id: "health", label: "健康检查", price: "¥168起", icon: "🩺" },
  { id: "walking", label: "遛狗陪伴", price: "¥58起", icon: "🦮" },
];

const timeSlots = [
  "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
];

const nearbyStores = [
  { name: "萌宠乐园·浦东店", address: "浦东新区张杨路500号", distance: "0.8km", rating: 4.9 },
  { name: "爱宠之家·陆家嘴店", address: "浦东新区东方路300号", distance: "1.5km", rating: 4.8 },
  { name: "宠物天堂·世纪公园店", address: "浦东新区锦绣路200号", distance: "2.1km", rating: 4.7 },
];

const BookingPage = () => {
  const navigate = useNavigate();
  const [selectedPet, setSelectedPet] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [notes, setNotes] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [needPickup, setNeedPickup] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "store" | "pickup">("home");

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-3 px-4 h-14 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-extrabold text-lg text-foreground">预约详情</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pt-4">
        {/* Service Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: "home" as const, label: "上门服务", icon: PawPrint },
            { key: "store" as const, label: "门店寄养", icon: Building2 },
            { key: "pickup" as const, label: "宠物接送", icon: Car },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 rounded-xl font-semibold text-sm transition-all",
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Pet Type */}
        <section className="mb-6 animate-fade-in-up">
          <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <PawPrint className="w-4 h-4 text-primary" /> 选择宠物类型
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {petTypes.map((pet) => (
              <button
                key={pet.id}
                onClick={() => setSelectedPet(pet.id)}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 rounded-xl transition-all text-sm font-medium",
                  selectedPet === pet.id
                    ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "bg-card card-shadow hover:bg-secondary"
                )}
              >
                <span className="text-2xl">{pet.emoji}</span>
                {pet.label}
              </button>
            ))}
          </div>
        </section>

        {/* Service Type (for home service tab) */}
        {activeTab === "home" && (
          <section className="mb-6 animate-fade-in-up">
            <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
              ✨ 选择服务项目
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {serviceTypes.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedService(s.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-all text-left",
                    selectedService === s.id
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "bg-card card-shadow hover:bg-secondary"
                  )}
                >
                  <span className="text-2xl">{s.icon}</span>
                  <div>
                    <div className="font-bold text-sm">{s.label}</div>
                    <div className={cn("text-xs", selectedService === s.id ? "text-primary-foreground/80" : "text-muted-foreground")}>{s.price}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Nearby Stores (for store tab) */}
        {activeTab === "store" && (
          <section className="mb-6 animate-fade-in-up">
            <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> 附近门店
            </h2>
            <div className="flex flex-col gap-2">
              {nearbyStores.map((store) => (
                <button
                  key={store.name}
                  onClick={() => setSelectedStore(store.name)}
                  className={cn(
                    "p-4 rounded-xl text-left transition-all",
                    selectedStore === store.name
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "bg-card card-shadow hover:bg-secondary"
                  )}
                >
                  <div className="font-bold text-sm">{store.name}</div>
                  <div className={cn("text-xs mt-1 flex items-center gap-1", selectedStore === store.name ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    <MapPin className="w-3 h-3" /> {store.address} · {store.distance}
                  </div>
                  <div className={cn("text-xs mt-0.5", selectedStore === store.name ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    ⭐ {store.rating} 分
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Pickup Address (for pickup tab) */}
        {activeTab === "pickup" && (
          <section className="mb-6 animate-fade-in-up">
            <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Car className="w-4 h-4 text-primary" /> 接送地址
            </h2>
            <div className="bg-card rounded-xl p-4 card-shadow space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">取宠地址</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="请输入取宠地址（支持高德地图定位）"
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-secondary text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
              </div>
              <div className="rounded-lg overflow-hidden border border-border h-40 flex items-center justify-center bg-muted">
                <div className="text-center text-muted-foreground">
                  <MapPin className="w-8 h-8 mx-auto mb-2 text-primary/50" />
                  <p className="text-sm">高德地图定位</p>
                  <p className="text-xs mt-1">接入高德地图 API 后显示地图</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Date & Time */}
        <section className="mb-6 animate-fade-in-up">
          <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" /> 预约时间
          </h2>
          <div className="bg-card rounded-xl p-4 card-shadow space-y-4">
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn(
                  "w-full flex items-center gap-2 py-2.5 px-3 rounded-lg bg-secondary text-sm transition-all hover:bg-muted",
                  !selectedDate && "text-muted-foreground"
                )}>
                  <CalendarDays className="w-4 h-4" />
                  {selectedDate ? format(selectedDate, "yyyy年MM月dd日 EEEE", { locale: zhCN }) : "选择日期"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date()}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <div>
              <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> 选择时段
              </p>
              <div className="grid grid-cols-3 gap-2">
                {timeSlots.map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTime(t)}
                    className={cn(
                      "py-2 rounded-lg text-sm font-medium transition-all",
                      selectedTime === t
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-muted"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Notes */}
        <section className="mb-6 animate-fade-in-up">
          <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> 备注信息
          </h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="请填写宠物特殊情况（如：性格、过敏、特殊需求等）"
            rows={3}
            className="w-full p-4 rounded-xl bg-card card-shadow text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
          />
        </section>

        {/* Summary & Submit */}
        <div className="sticky bottom-16 bg-background/90 backdrop-blur-md py-4 border-t border-border/50">
          <Button variant="hero" size="xl" className="w-full">
            确认预约
          </Button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default BookingPage;
