import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  MapPin,
  PawPrint,
  FileText,
  Car,
  Building2,
  CalendarDays,
  ShieldCheck,
  Camera,
} from "lucide-react";
import AMapReal from "@/components/AMapReal";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import BottomNav from "@/components/BottomNav";
import { PET_TYPES, SERVICE_TYPES, TIME_SLOTS, NEARBY_STORES } from "@/config/booking";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────
type BookingTab = "home" | "store" | "pickup";
type DriverGender = "any" | "male" | "female";

// ─── Pickup service tiers (滴滴风格) ─────────────────────────────────────────
const PICKUP_TIERS: ReadonlyArray<{
  id: string;
  icon: string;
  label: string;
  desc: string;
  tags: readonly string[];
  price: number;
  priceLabel: string;
  recommended?: boolean;
}> = [
  {
    id: "share",
    icon: "🚐",
    label: "顺路拼单",
    desc: "与其他宠物同行",
    tags: ["经济实惠", "社交体验"],
    price: 15,
    priceLabel: "¥15 起",
  },
  {
    id: "express",
    icon: "🚗",
    label: "专车接送",
    desc: "专属司机，全程陪护",
    tags: ["门对门", "宠物险", "实时追踪"],
    price: 35,
    priceLabel: "¥35 起",
    recommended: true,
  },
  {
    id: "night",
    icon: "🌙",
    label: "夜间急送",
    desc: "22:00—06:00 随叫随到",
    tags: ["24h 可约", "急诊优先"],
    price: 45,
    priceLabel: "¥45 起",
  },
  {
    id: "luxury",
    icon: "🚙",
    label: "豪华专宠",
    desc: "SUV + 宠物护理师随行",
    tags: ["SUV 车型", "护理师", "拍照记录"],
    price: 88,
    priceLabel: "¥88 起",
  },
] as const;

// ─── Driver gender options ─────────────────────────────────────────────────
const GENDER_OPTIONS: { value: DriverGender; label: string; icon: string; note: string }[] = [
  { value: "any", label: "不限性别", icon: "🤝", note: "系统自动匹配最近司机，等待时间最短。" },
  { value: "male", label: "男司机", icon: "👨", note: "优先匹配男性认证司机，预计等待约 15–20 分钟。" },
  { value: "female", label: "女司机", icon: "👩", note: "优先匹配女性认证司机，预计等待约 20–30 分钟。" },
];

// ─── Tab config ────────────────────────────────────────────────────────────
const TAB_OPTIONS: readonly { key: BookingTab; label: string; icon: typeof PawPrint }[] = [
  { key: "home", label: "上门服务", icon: PawPrint },
  { key: "store", label: "门店寄养", icon: Building2 },
  { key: "pickup", label: "宠物接送", icon: Car },
];

// ─── Component ────────────────────────────────────────────────────────────────
const BookingPage = () => {
  const navigate = useNavigate();

  // Shared state
  const [selectedPet, setSelectedPet] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [notes, setNotes] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [activeTab, setActiveTab] = useState<BookingTab>("home");

  // Pickup-specific state
  const [selectedTier, setSelectedTier] = useState<string>("express");
  const [driverGender, setDriverGender] = useState<DriverGender>("any");
  const [addInsurance, setAddInsurance] = useState(true);
  const [addPhoto, setAddPhoto] = useState(false);
  const [timeMode, setTimeMode] = useState<"now" | "scheduled" | "habit">("now");
  const [scheduledSlot, setScheduledSlot] = useState<string>("");
  const [routeKm, setRouteKm] = useState<number | null>(null);

  // ─── Derived values ──────────────────────────────────────────────────────
  const currentTier = PICKUP_TIERS.find((t) => t.id === selectedTier) ?? PICKUP_TIERS[1];
  const genderOption = GENDER_OPTIONS.find((g) => g.value === driverGender)!;
  // 距离动态加价：每公里 2 元，向上取整；无路线则按起步价
  const distanceSurcharge = routeKm ? Math.max(0, Math.ceil(routeKm) * 2) : 0;
  const tierDynamicPrice = (price: number) => price + distanceSurcharge;
  const pickupTotal = tierDynamicPrice(currentTier.price) + (addInsurance ? 8 : 0) + (addPhoto ? 5 : 0);

  // ─── Submit handler ──────────────────────────────────────────────────────
  const handleSubmit = () => {
    const petInfo = PET_TYPES.find((p) => p.id === selectedPet);
    const serviceInfo = SERVICE_TYPES.find((s) => s.id === selectedService);
    const priceStr = serviceInfo?.price?.replace(/[^0-9]/g, "") || "0";
    const amount = activeTab === "home" ? Number(priceStr) : activeTab === "store" ? 199 : pickupTotal;

    navigate("/payment", {
      state: {
        order_type: activeTab,
        service_type: activeTab === "pickup" ? selectedTier : selectedService || activeTab,
        pet_type: selectedPet,
        booking_date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined,
        booking_time: selectedTime,
        store_name: selectedStore || undefined,
        pickup_address: pickupAddress || undefined,
        dropoff_address: dropoffAddress || undefined,
        notes: notes || undefined,
        total_amount: amount,
        service_label:
          activeTab === "pickup"
            ? `${currentTier.label}${addInsurance ? " + 保险" : ""}`
            : serviceInfo?.label || (activeTab === "store" ? "门店寄养" : "宠物接送"),
        pet_label: petInfo ? `${petInfo.emoji} ${petInfo.label}` : undefined,
        // pickup extras
        driver_gender: activeTab === "pickup" ? driverGender : undefined,
        add_insurance: activeTab === "pickup" ? addInsurance : undefined,
        add_photo: activeTab === "pickup" ? addPhoto : undefined,
        time_mode: activeTab === "pickup" ? timeMode : undefined,
        scheduled_time:
          activeTab === "pickup" && timeMode === "scheduled" && selectedDate && selectedTime
            ? `${format(selectedDate, "yyyy-MM-dd")} ${selectedTime}`
            : undefined,
        route_distance_km: activeTab === "pickup" ? routeKm ?? undefined : undefined,
        pickup_tier:
          activeTab === "pickup"
            ? {
                id: currentTier.id,
                label: currentTier.label,
                desc: currentTier.desc,
                price: tierDynamicPrice(currentTier.price),
                priceLabel: `¥${tierDynamicPrice(currentTier.price)}`,
                recommended: currentTier.recommended === true,
              }
            : undefined,
      },
    });
  };

  // ─── Submit disabled logic ────────────────────────────────────────────────
  const pickupNeedsDateTime = activeTab === "pickup" && timeMode === "scheduled";
  const otherNeedsDateTime = activeTab !== "pickup";
  const needsDateTime = pickupNeedsDateTime || otherNeedsDateTime;

  const isDisabled =
    !selectedPet ||
    (needsDateTime && (!selectedDate || !selectedTime)) ||
    (activeTab === "home" && !selectedService) ||
    (activeTab === "store" && !selectedStore) ||
    (activeTab === "pickup" && (!pickupAddress || !dropoffAddress));

  // ─── Render ───────────────────────────────────────────────────────────────
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
        {/* ── Service Tabs ── */}
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
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              <tab.icon className="w-5 h-5" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Pet Type ── */}
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
                    : "bg-card card-shadow hover:bg-secondary",
                )}
              >
                <span className="text-2xl" aria-hidden="true">
                  {pet.emoji}
                </span>
                {pet.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Home: Service Type ── */}
        {activeTab === "home" && (
          <section className="mb-6 animate-fade-in-up" aria-label="服务项目">
            <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">✨ 选择服务项目</h2>
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
                      : "bg-card card-shadow hover:bg-secondary",
                  )}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {s.icon}
                  </span>
                  <div>
                    <div className="font-bold text-sm">{s.label}</div>
                    <div
                      className={cn(
                        "text-xs",
                        selectedService === s.id ? "text-primary-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      {s.price}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Store: Nearby Stores ── */}
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
                      : "bg-card card-shadow hover:bg-secondary",
                  )}
                >
                  <div className="font-bold text-sm">{store.name}</div>
                  <div
                    className={cn(
                      "text-xs mt-1 flex items-center gap-1",
                      selectedStore === store.name ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    <MapPin className="w-3 h-3" aria-hidden="true" /> {store.address} · {store.distance}
                  </div>
                  <div
                    className={cn(
                      "text-xs mt-0.5",
                      selectedStore === store.name ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    ⭐ {store.rating} 分
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Pickup Tab ── */}
        {activeTab === "pickup" && (
          <>
            {/* Map / Address */}
            <section className="mb-6 animate-fade-in-up" aria-label="宠物接送地址">
              <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
                <Car className="w-4 h-4 text-primary" aria-hidden="true" /> 接送地址
              </h2>
              <AMapReal
                pickupAddress={pickupAddress}
                onPickupAddressChange={setPickupAddress}
                dropoffAddress={dropoffAddress}
                onDropoffAddressChange={setDropoffAddress}
                onRouteChange={(info) => setRouteKm(info?.distanceKm ?? null)}
              />
              {routeKm !== null && (
                <p className="mt-2 text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">
                  📍 路程约 <span className="font-semibold text-primary">{routeKm.toFixed(1)} 公里</span>，距离加价 <span className="font-semibold text-primary">+¥{distanceSurcharge}</span>（每公里 ¥2）
                </p>
              )}
            </section>

            {/* ── Service Tiers (DiDi-style) ── */}
            <section className="mb-6 animate-fade-in-up" aria-label="接送方式">
              <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">🚗 选择接送方式</h2>
              <div className="flex flex-col gap-2" role="radiogroup" aria-label="接送方式选择">
                {PICKUP_TIERS.map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    role="radio"
                    aria-checked={selectedTier === tier.id}
                    onClick={() => setSelectedTier(tier.id)}
                    className={cn(
                      "relative flex items-center gap-3 p-3 rounded-xl text-left transition-all min-h-[44px] border",
                      selectedTier === tier.id
                        ? "bg-primary/10 border-primary ring-2 ring-primary ring-offset-1 ring-offset-background"
                        : "bg-card border-border card-shadow hover:bg-secondary",
                    )}
                  >
                    {/* Recommended badge */}
                    {tier.recommended && (
                      <span className="absolute top-0 right-0 text-[10px] font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-bl-lg rounded-tr-xl">
                        推荐
                      </span>
                    )}

                    {/* Icon */}
                    <span className="text-2xl w-9 text-center flex-shrink-0" aria-hidden="true">
                      {tier.icon}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-foreground">{tier.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{tier.desc}</div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {tier.tags.map((tag) => (
                          <span
                            key={tag}
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-md border",
                              selectedTier === tier.id
                                ? "bg-primary/10 border-primary/30 text-primary"
                                : "bg-secondary border-border text-muted-foreground",
                            )}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Price + radio */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right leading-tight">
                        <div
                          className={cn(
                            "text-sm font-bold",
                            selectedTier === tier.id ? "text-primary" : "text-foreground",
                          )}
                        >
                          ¥{tierDynamicPrice(tier.price)}
                        </div>
                        {routeKm !== null && distanceSurcharge > 0 && (
                          <div className="text-[10px] text-muted-foreground">起 ¥{tier.price} +距离</div>
                        )}
                      </div>
                      <span
                        className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                          selectedTier === tier.id ? "border-primary bg-primary" : "border-muted-foreground",
                        )}
                        aria-hidden="true"
                      >
                        {selectedTier === tier.id && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                        )}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* ── Driver Gender Preference ── */}
            <section className="mb-6 animate-fade-in-up" aria-label="司机性别偏好">
              <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
                👤 司机偏好
                <span className="text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full">
                  新
                </span>
              </h2>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="司机性别选择">
                {GENDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={driverGender === opt.value}
                    onClick={() => setDriverGender(opt.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all text-sm font-medium min-h-[44px] border",
                      driverGender === opt.value
                        ? "bg-primary/10 border-primary ring-2 ring-primary ring-offset-1 ring-offset-background"
                        : "bg-card border-border card-shadow hover:bg-secondary",
                    )}
                  >
                    <span className="text-xl" aria-hidden="true">
                      {opt.icon}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        driverGender === opt.value ? "text-primary font-semibold" : "text-muted-foreground",
                      )}
                    >
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
              {/* Context note */}
              <p className="mt-2 text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2 leading-relaxed">
                💬 {genderOption.note}
              </p>
            </section>

            {/* ── Add-on Services ── */}
            <section className="mb-6 animate-fade-in-up" aria-label="附加服务">
              <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">✨ 附加服务</h2>
              <div className="bg-card card-shadow rounded-xl divide-y divide-border">
                {/* Insurance */}
                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer min-h-[52px]">
                  <ShieldCheck className="w-5 h-5 text-green-500 flex-shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">宠物意外险</div>
                    <div className="text-xs text-muted-foreground mt-0.5">行程内保额 ¥5,000</div>
                  </div>
                  <span className="text-sm font-medium text-primary mr-2">+¥8</span>
                  {/* Toggle */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={addInsurance}
                    onClick={() => setAddInsurance((v) => !v)}
                    className={cn(
                      "relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 focus:outline-none",
                      addInsurance ? "bg-primary" : "bg-muted",
                    )}
                    style={{ width: 40, height: 22 }}
                    aria-label="开启宠物意外险"
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-transform",
                        addInsurance ? "translate-x-[19px]" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </label>

                {/* Photo */}
                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer min-h-[52px]">
                  <Camera className="w-5 h-5 text-blue-500 flex-shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">行程照片记录</div>
                    <div className="text-xs text-muted-foreground mt-0.5">司机沿途拍照实时发送</div>
                  </div>
                  <span className="text-sm font-medium text-primary mr-2">+¥5</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={addPhoto}
                    onClick={() => setAddPhoto((v) => !v)}
                    className={cn(
                      "relative rounded-full transition-colors flex-shrink-0 focus:outline-none",
                      addPhoto ? "bg-primary" : "bg-muted",
                    )}
                    style={{ width: 40, height: 22 }}
                    aria-label="开启行程照片记录"
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-transform",
                        addPhoto ? "translate-x-[19px]" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </label>
              </div>
            </section>

            {/* ── Time Mode (DiDi-style) ── */}
            <section className="mb-6 animate-fade-in-up" aria-label="出发时间">
              <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">⏱️ 出发时间</h2>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="时间模式">
                {([
                  { v: "now", label: "立即预约", desc: "5 分钟内派单" },
                  { v: "scheduled", label: "预约时段", desc: "选择具体时间" },
                  { v: "habit", label: "我的习惯", desc: "每周三 10:00" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    role="radio"
                    aria-checked={timeMode === opt.v}
                    onClick={() => setTimeMode(opt.v)}
                    className={cn(
                      "flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-all text-sm font-medium border min-h-[44px]",
                      timeMode === opt.v
                        ? "bg-primary/10 border-primary ring-2 ring-primary ring-offset-1 ring-offset-background"
                        : "bg-card border-border card-shadow hover:bg-secondary",
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        timeMode === opt.v ? "text-primary" : "text-foreground",
                      )}
                    >
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-tight text-center">
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ── Date & Time (skipped for pickup unless 预约时段 selected) ── */}
        {needsDateTime && (
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
                    !selectedDate && "text-muted-foreground",
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
                        : "bg-secondary text-secondary-foreground hover:bg-muted",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
        )}

        {/* ── Notes ── */}
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

      {/* ── Fixed Submit Bar ── */}
      <div className="fixed bottom-16 left-0 right-0 z-30 bg-background/95 backdrop-blur-md border-t border-border/50 px-5 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          {/* Price summary for pickup */}
          {activeTab === "pickup" && (
            <div className="flex-shrink-0">
              <div className="text-xl font-extrabold text-primary">¥{pickupTotal}</div>
              <div className="text-[10px] text-muted-foreground leading-tight">
                {currentTier.label}
                {addInsurance ? " + 保险" : ""}
                {addPhoto ? " + 照片" : ""}
              </div>
            </div>
          )}
          <Button variant="hero" size="xl" className="flex-1" disabled={isDisabled} onClick={handleSubmit}>
            确认预约
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default BookingPage;
