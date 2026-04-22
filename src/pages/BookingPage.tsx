import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, MapPin, PawPrint, FileText, Car, Building2, CalendarDays } from "lucide-react";
import AMapReal from "@/components/AMapReal";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import BottomNav from "@/components/BottomNav";
import { PET_TYPES, SERVICE_TYPES, TIME_SLOTS, NEARBY_STORES } from "@/config/booking";

type BookingTab = "home" | "store" | "pickup";

const TAB_OPTIONS: readonly { key: BookingTab; label: string; icon: typeof PawPrint }[] = [
  { key: "home", label: "上门服务", icon: PawPrint },
  { key: "store", label: "门店寄养", icon: Building2 },
  { key: "pickup", label: "宠物接送", icon: Car },
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
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [activeTab, setActiveTab] = useState<BookingTab>("home");

  return (
    <div className="min-h-screen bg-background pb-nav">
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
          <h1 className="font-extrabold text-lg text-foreground">预约详情</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 pt-4">
        {/* Service Tabs */}
        <div className="flex gap-2 mb-6" role="tablist" aria-label="服务类型">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 rounded-xl font-semibold text-sm transition-all min-h-[44px]",
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              <tab.icon className="w-5 h-5" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Pet Type */}
        <section className="mb-6 animate-fade-in-up" aria-label="宠物类型">
          <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <PawPrint className="w-4 h-4 text-primary" aria-hidden="true" /> 选择宠物类型
          </h2>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="宠物类型选择">
            {PET_TYPES.map((pet) => (
              <button
                key={pet.id}
                type="button"
                role="radio"
                aria-checked={selectedPet === pet.id}
                onClick={() => setSelectedPet(pet.id)}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 rounded-xl transition-all text-sm font-medium min-h-[44px]",
                  selectedPet === pet.id
                    ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "bg-card card-shadow hover:bg-secondary"
                )}
              >
                <span className="text-2xl" aria-hidden="true">{pet.emoji}</span>
                {pet.label}
              </button>
            ))}
          </div>
        </section>

        {/* Service Type (for home service tab) */}
        {activeTab === "home" && (
          <section className="mb-6 animate-fade-in-up" aria-label="服务项目">
            <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
              ✨ 选择服务项目
            </h2>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="服务项目选择">
              {SERVICE_TYPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedService === s.id}
                  onClick={() => setSelectedService(s.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-all text-left min-h-[44px]",
                    selectedService === s.id
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "bg-card card-shadow hover:bg-secondary"
                  )}
                >
                  <span className="text-2xl" aria-hidden="true">{s.icon}</span>
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
          <section className="mb-6 animate-fade-in-up" aria-label="附近门店">
            <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" aria-hidden="true" /> 附近门店
            </h2>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="门店选择">
              {NEARBY_STORES.map((store) => (
                <button
                  key={store.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedStore === store.name}
                  onClick={() => setSelectedStore(store.name)}
                  className={cn(
                    "p-4 rounded-xl text-left transition-all min-h-[44px]",
                    selectedStore === store.name
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "bg-card card-shadow hover:bg-secondary"
                  )}
                >
                  <div className="font-bold text-sm">{store.name}</div>
                  <div className={cn("text-xs mt-1 flex items-center gap-1", selectedStore === store.name ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    <MapPin className="w-3 h-3" aria-hidden="true" /> {store.address} · {store.distance}
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
          <section className="mb-6 animate-fade-in-up" aria-label="宠物接送">
            <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Car className="w-4 h-4 text-primary" aria-hidden="true" /> 宠物接送
            </h2>
            <AMapReal
              pickupAddress={pickupAddress}
              onPickupAddressChange={setPickupAddress}
              dropoffAddress={dropoffAddress}
              onDropoffAddressChange={setDropoffAddress}
            />
          </section>
        )}

        {/* Date & Time */}
        <section className="mb-6 animate-fade-in-up" aria-label="预约时间">
          <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" aria-hidden="true" /> 预约时间
          </h2>
          <div className="bg-card rounded-xl p-4 card-shadow space-y-4">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-2 py-2.5 px-3 rounded-lg bg-secondary text-sm transition-all hover:bg-muted min-h-[44px]",
                    !selectedDate && "text-muted-foreground"
                  )}
                  aria-label="选择预约日期"
                >
                  <CalendarDays className="w-4 h-4" aria-hidden="true" />
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
                <Clock className="w-3.5 h-3.5" aria-hidden="true" /> 选择时段
              </p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="时段选择">
                {TIME_SLOTS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={selectedTime === t}
                    onClick={() => setSelectedTime(t)}
                    className={cn(
                      "py-2 rounded-lg text-sm font-medium transition-all min-h-[44px]",
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
        <section className="mb-6 animate-fade-in-up" aria-label="备注信息">
          <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" aria-hidden="true" /> 备注信息
          </h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="请填写宠物特殊情况（如：性格、过敏、特殊需求等）"
            rows={3}
            className="w-full p-4 rounded-xl bg-card card-shadow text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring transition-all resize-none"
            aria-label="备注信息输入框"
          />
        </section>

      </main>

      {/* Fixed Submit Bar (above BottomNav) */}
      <div className="fixed bottom-16 left-0 right-0 z-30 bg-background/95 backdrop-blur-md border-t border-border/50 px-5 py-3">
        <div className="max-w-lg mx-auto">
          <Button
            variant="hero"
            size="xl"
            className="w-full"
            disabled={!selectedPet || !selectedDate || !selectedTime || (activeTab === "home" && !selectedService) || (activeTab === "store" && !selectedStore)}
            onClick={() => {
              const petInfo = PET_TYPES.find((p) => p.id === selectedPet);
              const serviceInfo = SERVICE_TYPES.find((s) => s.id === selectedService);
              const priceStr = serviceInfo?.price?.replace(/[^0-9]/g, "") || "0";
              const amount = activeTab === "home" ? Number(priceStr) : activeTab === "store" ? 199 : 99;

              navigate("/payment", {
                state: {
                  order_type: activeTab,
                  service_type: selectedService || activeTab,
                  pet_type: selectedPet,
                  booking_date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined,
                  booking_time: selectedTime,
                  store_name: selectedStore || undefined,
                  pickup_address: pickupAddress || undefined,
                  dropoff_address: dropoffAddress || undefined,
                  notes: notes || undefined,
                  total_amount: amount,
                  service_label: serviceInfo?.label || (activeTab === "store" ? "门店寄养" : "宠物接送"),
                  pet_label: petInfo ? `${petInfo.emoji} ${petInfo.label}` : undefined,
                },
              });
            }}
          >
            确认预约
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default BookingPage;
