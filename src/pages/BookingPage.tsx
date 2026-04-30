import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  Sparkles,
  Loader2,
} from "lucide-react";
import AMapReal from "@/components/AMapReal";
import ReactMarkdown from "react-markdown";
import {
  fetchAISummary,
  AIServiceError,
  type AdvicePlan,
  type TimelineStep,
  getOfflineFallback,
} from "@/lib/aiSummary";
import { toast } from "sonner";
import { Headphones, Save, RefreshCw, CheckCircle2 as CheckIcon } from "lucide-react";
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

  const location = useLocation();
  const { user } = useAuth();
  const prefill = (location.state as any)?.prefill;

  // Shared state
  const [selectedPet, setSelectedPet] = useState("");
  const [savedPets, setSavedPets] = useState<any[]>([]);
  const [selectedSavedPetId, setSelectedSavedPetId] = useState<string>("");
  const [tripPetNote, setTripPetNote] = useState<string>("");
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
  const [routeKm, setRouteKm] = useState<number | null>(null);
  const [routeDurationMin, setRouteDurationMin] = useState<number | null>(null);
  const [routeStatus, setRouteStatus] = useState<"idle" | "ok" | "error" | "outdated">("idle");
  const [routeError, setRouteError] = useState<string>("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const planRouteRef = useRef<(() => void) | null>(null);

  // ── AI assistant state ────────────────────────────────────────────────
  const [aiRouteText, setAiRouteText] = useState("");
  const [aiRouteLoading, setAiRouteLoading] = useState(false);
  const [aiRouteError, setAiRouteError] = useState<AIServiceError | null>(null);
  const [aiTimeline, setAiTimeline] = useState<TimelineStep[]>([]);
  const [aiTimelineLoading, setAiTimelineLoading] = useState(false);

  const [aiPlans, setAiPlans] = useState<AdvicePlan[]>([]);
  const [aiAdviceFallbackText, setAiAdviceFallbackText] = useState("");
  const [aiAdviceLoading, setAiAdviceLoading] = useState(false);
  const [aiAdviceError, setAiAdviceError] = useState<AIServiceError | null>(null);
  const [selectedPlanIdx, setSelectedPlanIdx] = useState(0);

  const draftKey = "booking_draft_v1";
  const saveDraft = () => {
    try {
      const draft = {
        activeTab, selectedPet, selectedService, selectedDate: selectedDate?.toISOString(),
        selectedTime, selectedStore, notes, pickupAddress, dropoffAddress,
        selectedTier, driverGender, addInsurance, addPhoto, timeMode,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      toast.success("草稿已保存，下次回到此页面可继续下单");
    } catch {
      toast.error("草稿保存失败");
    }
  };

  // Debounced AI route explanation + timeline when route is ready
  useEffect(() => {
    if (activeTab !== "pickup" || routeStatus !== "ok" || routeKm === null || routeDurationMin === null) {
      setAiRouteText(""); setAiTimeline([]); setAiRouteError(null);
      return;
    }
    const handle = setTimeout(() => {
      let cancelled = false;
      setAiRouteLoading(true);
      setAiTimelineLoading(true);
      const ctx = {
        上车点: pickupAddress,
        下车点: dropoffAddress,
        预计里程_公里: routeKm,
        预计耗时_分钟: routeDurationMin,
        宠物类型: PET_TYPES.find((p) => p.id === selectedPet)?.label || "未选择",
        时间安排: timeMode === "now" ? "立即出发" : "预约时段",
      };
      fetchAISummary("route_explain", ctx)
        .then((r) => { if (!cancelled) { setAiRouteText(r.text || ""); setAiRouteError(null); } })
        .catch((err: AIServiceError) => {
          if (!cancelled) { setAiRouteText(getOfflineFallback("route_explain")); setAiRouteError(err); }
        })
        .finally(() => { if (!cancelled) setAiRouteLoading(false); });

      fetchAISummary("route_timeline", ctx)
        .then((r) => { if (!cancelled) setAiTimeline(r.timeline || []); })
        .catch(() => { if (!cancelled) setAiTimeline([]); })
        .finally(() => { if (!cancelled) setAiTimelineLoading(false); });

      return () => { cancelled = true; };
    }, 600);
    return () => clearTimeout(handle);
  }, [activeTab, routeStatus, routeKm, routeDurationMin, pickupAddress, dropoffAddress, selectedPet, timeMode]);

  // Generate AI booking advice (multi-plan) when confirm dialog opens
  useEffect(() => {
    if (!showConfirm) {
      setAiPlans([]); setAiAdviceFallbackText(""); setAiAdviceError(null); setSelectedPlanIdx(0);
      return;
    }
    let cancelled = false;
    setAiAdviceLoading(true);
    const petLabel = PET_TYPES.find((p) => p.id === selectedPet)?.label || "未选择";
    const serviceLabel =
      activeTab === "home"
        ? `上门服务 · ${SERVICE_TYPES.find((s) => s.id === selectedService)?.label || ""}`
        : activeTab === "store"
          ? "到店服务"
          : "宠物接送";
    fetchAISummary("booking_advice", {
      服务类型: serviceLabel,
      宠物类型: petLabel,
      备注: notes || "无",
      接送方式: activeTab === "pickup" ? `路线 ${routeKm?.toFixed(1) ?? "—"} km / ${routeDurationMin ?? "—"} 分钟` : "无需接送",
      时间安排: timeMode === "now" ? "立即预约" : "预约时段",
    })
      .then((r) => {
        if (cancelled) return;
        const plans = (r.plans || []) as AdvicePlan[];
        setAiPlans(plans);
        setAiAdviceFallbackText(plans.length ? "" : (r.text || ""));
        const recIdx = plans.findIndex((p) => p.recommended);
        setSelectedPlanIdx(recIdx >= 0 ? recIdx : 0);
        setAiAdviceError(null);
      })
      .catch((err: AIServiceError) => {
        if (!cancelled) {
          setAiPlans([]); setAiAdviceFallbackText(getOfflineFallback("booking_advice")); setAiAdviceError(err);
        }
      })
      .finally(() => { if (!cancelled) setAiAdviceLoading(false); });
    return () => { cancelled = true; };
  }, [showConfirm, activeTab, selectedPet, selectedService, notes, routeKm, routeDurationMin, timeMode]);

  const retryAdvice = () => {
    // Re-trigger via toggle of showConfirm-driven effect by bumping a state
    setAiAdviceError(null);
    setAiPlans([]);
    setAiAdviceLoading(true);
    const petLabel = PET_TYPES.find((p) => p.id === selectedPet)?.label || "未选择";
    fetchAISummary("booking_advice", { 重试: true, 宠物类型: petLabel, 备注: notes || "无", 服务: activeTab })
      .then((r) => {
        const plans = (r.plans || []) as AdvicePlan[];
        setAiPlans(plans);
        setAiAdviceFallbackText(plans.length ? "" : (r.text || ""));
      })
      .catch((err: AIServiceError) => { setAiAdviceError(err); setAiAdviceFallbackText(getOfflineFallback("booking_advice")); })
      .finally(() => setAiAdviceLoading(false));
  };


  // 切换 time_mode 时清空已选时段并重置校验状态，避免旧选择残留
  useEffect(() => {
    setSelectedTime("");
    setSubmitAttempted(false);
  }, [timeMode]);

  // 加载用户的宠物档案
  useEffect(() => {
    if (!user) return;
    supabase
      .from("pets")
      .select("id,name,pet_type,breed,allergies,behavior_notes,vaccinations,auto_share,is_default")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const list = data || [];
        setSavedPets(list);
        const def = list.find((p: any) => p.is_default) || list[0];
        if (def && !selectedSavedPetId) {
          setSelectedSavedPetId(def.id);
          setSelectedPet(def.pet_type);
        }
      });
  }, [user]);

  // 历史订单复用：预填地址 + 宠物快照
  useEffect(() => {
    if (!prefill) return;
    if (prefill.pickup_address) setPickupAddress(prefill.pickup_address);
    if (prefill.dropoff_address) setDropoffAddress(prefill.dropoff_address);
    if (prefill.pet_snapshot?.pet_type) setSelectedPet(prefill.pet_snapshot.pet_type);
    if ((prefill.pickup_address || prefill.dropoff_address) && activeTab !== "pickup") setActiveTab("pickup");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // ─── Derived values ──────────────────────────────────────────────────────
  const currentTier = PICKUP_TIERS.find((t) => t.id === selectedTier) ?? PICKUP_TIERS[1];
  const genderOption = GENDER_OPTIONS.find((g) => g.value === driverGender)!;
  // 距离动态加价：每公里 2 元，向上取整；无路线则按起步价（fallback）
  const PER_KM = 2;
  const distanceSurcharge = routeKm !== null ? Math.max(0, Math.ceil(routeKm) * PER_KM) : 0;
  const tierDynamicPrice = (price: number) => price + distanceSurcharge;
  const addOnsTotal = (addInsurance ? 8 : 0) + (addPhoto ? 5 : 0);
  const pickupTotal = tierDynamicPrice(currentTier.price) + addOnsTotal;
  const isFallbackPrice = routeKm === null;

  // ─── Validation: per-field error map ─────────────────────────────────────
  const pickupNeedsDateTime = activeTab === "pickup" && timeMode === "scheduled";
  const otherNeedsDateTime = activeTab !== "pickup";
  const needsDateTime = pickupNeedsDateTime || otherNeedsDateTime;

  const errors = {
    pet: !selectedPet ? "请选择宠物类型" : "",
    service: activeTab === "home" && !selectedService ? "请选择服务项目" : "",
    store: activeTab === "store" && !selectedStore ? "请选择门店" : "",
    pickupAddress: activeTab === "pickup" && !pickupAddress ? "请填写上车地址" : "",
    dropoffAddress: activeTab === "pickup" && !dropoffAddress ? "请填写下车地址" : "",
    date: needsDateTime && !selectedDate ? "请选择预约日期" : "",
    time: needsDateTime && !selectedTime ? "请选择预约时段" : "",
  } as const;
  const errorList = Object.values(errors).filter(Boolean) as string[];
  const isDisabled = errorList.length > 0;

  // ─── Submit handler (open confirm dialog) ────────────────────────────────
  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (isDisabled) return;
    setShowConfirm(true);
  };

  // ─── Proceed to payment after user confirms ──────────────────────────────
  const proceedToPayment = () => {
    const petInfo = PET_TYPES.find((p) => p.id === selectedPet);
    const serviceInfo = SERVICE_TYPES.find((s) => s.id === selectedService);
    const priceStr = serviceInfo?.price?.replace(/[^0-9]/g, "") || "0";
    const amount = activeTab === "home" ? Number(priceStr) : activeTab === "store" ? 199 : pickupTotal;

    const savedPet = savedPets.find((p) => p.id === selectedSavedPetId);
    const petSnapshot = savedPet && savedPet.auto_share
      ? {
          id: savedPet.id,
          name: savedPet.name,
          pet_type: savedPet.pet_type,
          breed: savedPet.breed,
          allergies: savedPet.allergies || [],
          behavior_notes: savedPet.behavior_notes || [],
          vaccinations: savedPet.vaccinations || [],
          trip_note: tripPetNote || null,
        }
      : null;

    setShowConfirm(false);
    navigate("/payment", {
      state: {
        order_type: activeTab,
        service_type: activeTab === "pickup" ? selectedTier : selectedService || activeTab,
        pet_type: selectedPet,
        pet_id: savedPet?.id,
        pet_snapshot: petSnapshot,
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
        route_duration_min: activeTab === "pickup" ? routeDurationMin ?? undefined : undefined,
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

        {/* ── 我的宠物档案 ── */}
        {savedPets.length > 0 && (
          <section className="mb-4 animate-fade-in-up">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <PawPrint className="w-4 h-4 text-primary" /> 我的宠物
              </h2>
              <button onClick={() => navigate("/pets")} className="text-xs text-primary">管理档案 →</button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {savedPets.map((p) => {
                const active = selectedSavedPetId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedSavedPetId(p.id);
                      setSelectedPet(p.pet_type);
                      setTripPetNote("");
                    }}
                    className={cn(
                      "shrink-0 rounded-xl border px-3 py-2 text-left min-w-[120px]",
                      active ? "bg-primary/10 border-primary" : "bg-card",
                    )}
                  >
                    <div className="text-sm font-medium truncate">🐾 {p.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {p.allergies?.length > 0 ? `过敏:${p.allergies[0]}` : "档案完整"}
                    </div>
                    {p.auto_share && active && (
                      <div className="text-[10px] text-orange-500 mt-0.5">自动共享给司机</div>
                    )}
                  </button>
                );
              })}
              <button
                onClick={() => navigate("/pets")}
                className="shrink-0 rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground min-w-[80px]"
              >
                + 新增
              </button>
            </div>

            {/* 宠物快照预览（将写入订单的内容） */}
            {(() => {
              const sp = savedPets.find((p) => p.id === selectedSavedPetId);
              if (!sp) return null;
              if (!sp.auto_share) {
                return (
                  <div className="mt-2 rounded-xl border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
                    🔒 该宠物未开启「自动共享」，本次订单不会把档案推给司机。
                  </div>
                );
              }
              const activeVac = (sp.vaccinations || []).filter((v: any) => v?.expires_at && new Date(v.expires_at) > new Date());
              return (
                <div className="mt-2 rounded-xl border bg-card p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">📋 将发送给司机：{sp.name}</span>
                    <span className="text-orange-500 text-[10px]">下单后写入订单快照</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-emerald-500/10 p-2">
                      <p className="text-emerald-600 dark:text-emerald-400 font-medium">💉 有效疫苗</p>
                      <p className="text-muted-foreground">
                        {activeVac.length > 0 ? activeVac.map((v: any) => v.name).filter(Boolean).join("、") || `${activeVac.length} 项` : "无"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-amber-500/10 p-2">
                      <p className="text-amber-600 dark:text-amber-400 font-medium">⚠️ 过敏</p>
                      <p className="text-muted-foreground">{sp.allergies?.length ? sp.allergies.join("、") : "无"}</p>
                    </div>
                    <div className="rounded-lg bg-rose-500/10 p-2 col-span-2">
                      <p className="text-rose-600 dark:text-rose-400 font-medium">🚫 行为禁忌</p>
                      <p className="text-muted-foreground">{sp.behavior_notes?.length ? sp.behavior_notes.join("、") : "无"}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-muted-foreground text-[11px] block mb-1">
                      ✏️ 本次订单临时备注（仅影响本次，不修改档案）
                    </label>
                    <input
                      value={tripPetNote}
                      onChange={(e) => setTripPetNote(e.target.value)}
                      placeholder="例如：今天比较紧张，请轻声说话"
                      className="w-full h-8 px-2 rounded-md border bg-background text-xs"
                      maxLength={120}
                    />
                  </div>
                </div>
              );
            })()}
          </section>
        )}

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
          {submitAttempted && errors.pet && (
            <p role="alert" className="mt-2 text-xs text-destructive">⚠️ {errors.pet}</p>
          )}
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
            {submitAttempted && errors.service && (
              <p role="alert" className="mt-2 text-xs text-destructive">⚠️ {errors.service}</p>
            )}
          </section>
        )}
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
            {submitAttempted && errors.store && (
              <p role="alert" className="mt-2 text-xs text-destructive">⚠️ {errors.store}</p>
            )}
          </section>
        )}
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
                onPlanRouteReady={(fn) => {
                  planRouteRef.current = fn;
                }}
                onRouteChange={(info) => {
                  setRouteKm(info.distanceKm);
                  setRouteDurationMin(info.durationMin);
                  if (info.error) {
                    setRouteStatus("error");
                    setRouteError(info.error);
                  } else if (info.outdated) {
                    setRouteStatus("outdated");
                    setRouteError("");
                  } else if (info.distanceKm !== null) {
                    setRouteStatus("ok");
                    setRouteError("");
                  }
                }}
              />
              {routeStatus === "ok" && routeKm !== null && (
                <p className="mt-2 text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">
                  📍 路程约 <span className="font-semibold text-primary">{routeKm.toFixed(1)} 公里</span>，距离加价 <span className="font-semibold text-primary">+¥{distanceSurcharge}</span>（每公里 ¥{PER_KM}）
                </p>
              )}
              {routeStatus === "error" && (
                <div className="mt-2 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded-lg px-3 py-2 flex items-start justify-between gap-2">
                  <span className="flex-1">
                    ⚠️ {routeError || "路线规划失败"}，已按 <span className="font-semibold">起步价估算</span>。
                  </span>
                  <button
                    type="button"
                    onClick={() => planRouteRef.current?.()}
                    disabled={!pickupAddress || !dropoffAddress}
                    className="shrink-0 px-2.5 py-1 rounded-md bg-amber-500 text-white font-semibold text-[11px] hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    🔄 重试规划
                  </button>
                </div>
              )}
              {routeStatus === "outdated" && (
                <div className="mt-2 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded-lg px-3 py-2 flex items-start justify-between gap-2">
                  <span className="flex-1">
                    ⚠️ 地址已修改，路线已失效。当前 <span className="font-semibold">按起步价估算</span>。
                  </span>
                  <button
                    type="button"
                    onClick={() => planRouteRef.current?.()}
                    disabled={!pickupAddress || !dropoffAddress}
                    className="shrink-0 px-2.5 py-1 rounded-md bg-amber-500 text-white font-semibold text-[11px] hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    🔄 重新规划
                  </button>
                </div>
              )}
              {submitAttempted && (errors.pickupAddress || errors.dropoffAddress) && (
                <div role="alert" className="mt-2 text-xs text-destructive space-y-0.5">
                  {errors.pickupAddress && <p>⚠️ {errors.pickupAddress}</p>}
                  {errors.dropoffAddress && <p>⚠️ {errors.dropoffAddress}</p>}
                </div>
              )}
            </section>
            <section className="mb-6 animate-fade-in-up" aria-label="路线预览">
              <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
                🗺️ 路线预览
                <span className="text-[10px] font-medium bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                  高德实时规划
                </span>
              </h2>
              {pickupAddress && dropoffAddress && routeStatus === "ok" && routeKm !== null ? (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-primary/5 p-2">
                      <p className="text-[10px] text-muted-foreground">预计里程</p>
                      <p className="text-base font-extrabold text-primary mt-0.5">{routeKm.toFixed(1)} <span className="text-xs font-medium">km</span></p>
                    </div>
                    <div className="rounded-lg bg-primary/5 p-2">
                      <p className="text-[10px] text-muted-foreground">预计耗时</p>
                      <p className="text-base font-extrabold text-primary mt-0.5">
                        {routeDurationMin !== null ? routeDurationMin : "—"}
                        <span className="text-xs font-medium"> 分钟</span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-primary/5 p-2">
                      <p className="text-[10px] text-muted-foreground">距离加价</p>
                      <p className="text-base font-extrabold text-primary mt-0.5">+¥{distanceSurcharge}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">起</span>
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-[10px]">上车点</p>
                        <p className="text-foreground font-medium break-all">{pickupAddress}</p>
                      </div>
                    </div>
                    <div className="ml-2.5 border-l-2 border-dashed border-border h-3" aria-hidden="true" />
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">终</span>
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-[10px]">下车点</p>
                        <p className="text-foreground font-medium break-all">{dropoffAddress}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-4 text-xs text-muted-foreground text-center">
                  {!pickupAddress || !dropoffAddress
                    ? "请先在上方填写上下车地址，将自动规划路线并显示预计里程、耗时与上下车点"
                    : routeStatus === "error" || routeStatus === "outdated"
                      ? "路线暂未就绪，请使用上方「重新规划」按钮再次尝试"
                      : "正在规划路线…"}
                </div>
              )}

              {/* AI 路线解读 */}
              {routeStatus === "ok" && routeKm !== null && (aiRouteLoading || aiRouteText) && (
                <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="w-3.5 h-3.5" /> AI 路线解读 · 上下车贴士
                  </div>
                  {aiRouteLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" /> AI 正在分析路线…
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none text-foreground [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_strong]:text-primary">
                      <ReactMarkdown>{aiRouteText}</ReactMarkdown>
                    </div>
                  )}
                </div>
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
            {submitAttempted && errors.date && (
              <p role="alert" className="text-xs text-destructive">⚠️ {errors.date}</p>
            )}

            <div>
              <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" /> 选择时段
              </p>
              {activeTab === "pickup" && timeMode === "scheduled" ? (
                <>
                  <Select value={selectedTime} onValueChange={setSelectedTime}>
                    <SelectTrigger
                      className={cn(
                        "w-full",
                        submitAttempted && !selectedTime && "border-destructive ring-1 ring-destructive",
                      )}
                      aria-label="预约时段"
                      aria-invalid={submitAttempted && !selectedTime}
                      aria-describedby="scheduled-time-error"
                    >
                      <SelectValue placeholder="选择预约时段" />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-popover">
                      {TIME_SLOTS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t} - {String(Number(t.split(":")[0]) + 1).padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {submitAttempted && !selectedTime && (
                    <p
                      id="scheduled-time-error"
                      role="alert"
                      className="mt-1.5 text-xs text-destructive flex items-center gap-1"
                    >
                      ⚠️ 请选择预约时段后再提交
                    </p>
                  )}
                </>
              ) : (
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
              )}
              {submitAttempted && errors.time && !(activeTab === "pickup" && timeMode === "scheduled") && (
                <p role="alert" className="mt-1.5 text-xs text-destructive">⚠️ {errors.time}</p>
              )}
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
            onChange={(e) => setNotes(e.target.value.slice(0, 300))}
            placeholder="请填写宠物特殊情况（如：性格、过敏、特殊需求等）"
            rows={3}
            maxLength={300}
            className="w-full p-4 rounded-xl bg-card card-shadow text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring transition-all resize-none"
            aria-label="备注信息输入框"
          />
          <p className="mt-1 text-[10px] text-muted-foreground text-right">{notes.length}/300</p>
        </section>
      </main>

      {/* ── Fixed Submit Bar ── */}
      <div className="fixed bottom-16 left-0 right-0 z-30 bg-background/95 backdrop-blur-md border-t border-border/50">
        {/* Pickup price breakdown */}
        {activeTab === "pickup" && (
          <details className="max-w-lg mx-auto px-5 pt-2 group">
            <summary className="cursor-pointer text-xs text-muted-foreground flex items-center gap-1 select-none list-none [&::-webkit-details-marker]:hidden">
              <span className="font-semibold text-foreground">费用明细</span>
              <span className="text-[10px] opacity-70 group-open:rotate-180 transition-transform">▾</span>
              {isFallbackPrice && (
                <span className="ml-2 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  按起步价估算
                </span>
              )}
            </summary>
            <ul className="mt-2 space-y-1 text-xs bg-secondary/60 rounded-lg p-3">
              <li className="flex justify-between">
                <span className="text-muted-foreground">{currentTier.label} · 起步价</span>
                <span className="font-medium text-foreground">¥{currentTier.price}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">
                  距离加价
                  {routeKm !== null
                    ? ` (${routeKm.toFixed(1)} km × ¥${PER_KM} ⌈⌉)`
                    : "（暂无路线）"}
                </span>
                <span className={cn("font-medium", distanceSurcharge > 0 ? "text-foreground" : "text-muted-foreground")}>
                  +¥{distanceSurcharge}
                </span>
              </li>
              {isFallbackPrice && (
                <li className="text-[10px] text-amber-600 dark:text-amber-400 leading-snug bg-amber-500/5 rounded-md px-2 py-1.5 -mx-1">
                  ℹ️ {routeStatus === "outdated" ? "路线已失效" : "暂无路线"}：按 <span className="font-semibold">起步价估算</span>，距离加价 = ⌈距离 km⌉ × ¥{PER_KM}；当前距离未知，加价记 ¥0，待重新规划后自动更新。
                </li>
              )}
              {addInsurance && (
                <li className="flex justify-between">
                  <span className="text-muted-foreground">宠物意外险</span>
                  <span className="font-medium text-foreground">+¥8</span>
                </li>
              )}
              {addPhoto && (
                <li className="flex justify-between">
                  <span className="text-muted-foreground">行程照片记录</span>
                  <span className="font-medium text-foreground">+¥5</span>
                </li>
              )}
              <li className="flex justify-between border-t border-border/60 pt-1.5 mt-1.5">
                <span className="font-bold text-foreground">合计</span>
                <span className="font-extrabold text-primary">¥{pickupTotal}</span>
              </li>
            </ul>
          </details>
        )}

        {submitAttempted && errorList.length > 0 && (
          <div
            role="alert"
            className="max-w-lg mx-auto mx-5 mb-1 mt-1 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive"
          >
            <p className="font-semibold mb-0.5">⚠️ 还有 {errorList.length} 项待完善：</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {errorList.slice(0, 4).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="max-w-lg mx-auto px-5 py-3 flex items-center gap-4">
          {/* Price summary for pickup */}
          {activeTab === "pickup" && (
            <div className="flex-shrink-0">
              <div className="text-xl font-extrabold text-primary">¥{pickupTotal}</div>
              <div className="text-[10px] text-muted-foreground leading-tight">
                {currentTier.label}
                {addInsurance ? " + 保险" : ""}
                {addPhoto ? " + 照片" : ""}
                {isFallbackPrice && <span className="text-amber-600 dark:text-amber-400"> · 起步价</span>}
              </div>
            </div>
          )}
          <Button variant="hero" size="xl" className="flex-1" onClick={handleSubmit}>
            确认预约
          </Button>
        </div>
      </div>

      {/* ── Pre-submit Confirm Dialog ── */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 bg-foreground/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowConfirm(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-confirm-title"
        >
          <div
            className="bg-background w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-3 animate-fade-in-up max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="booking-confirm-title" className="text-lg font-extrabold text-foreground">
              确认预约信息
            </h3>
            <p className="text-xs text-muted-foreground">请核对以下信息，确认后将进入支付流程。</p>
            <div className="bg-secondary rounded-xl p-3 text-sm space-y-2">
              <ConfirmRow label="🏷️ 服务" value={
                activeTab === "home" ? `上门服务 · ${SERVICE_TYPES.find((s) => s.id === selectedService)?.label || ""}`
                : activeTab === "store" ? `门店寄养 · ${selectedStore}`
                : `宠物接送 · ${currentTier.label}`
              } />
              <ConfirmRow label="🐾 宠物" value={PET_TYPES.find((p) => p.id === selectedPet)?.label || "—"} />
              {needsDateTime && (
                <ConfirmRow
                  label="📅 时间"
                  value={`${selectedDate ? format(selectedDate, "yyyy-MM-dd") : "—"} ${selectedTime || ""}`.trim()}
                />
              )}
              {activeTab === "pickup" && timeMode === "now" && (
                <ConfirmRow label="📅 时间" value="立即预约（5 分钟内派单）" />
              )}
              {activeTab === "pickup" && (
                <>
                  <ConfirmRow label="🟢 上车" value={pickupAddress} />
                  <ConfirmRow label="🔴 下车" value={dropoffAddress} />
                  {routeKm !== null && (
                    <ConfirmRow
                      label="🗺️ 路线"
                      value={`约 ${routeKm.toFixed(1)} km · ${routeDurationMin ?? "—"} 分钟`}
                    />
                  )}
                </>
              )}
              {notes && <ConfirmRow label="📝 备注" value={notes} />}
              <div className="flex justify-between border-t border-border pt-2 mt-1 text-base font-extrabold">
                <span>合计</span>
                <span className="text-primary">
                  ¥{activeTab === "pickup"
                    ? pickupTotal
                    : activeTab === "store"
                      ? 199
                      : Number((SERVICE_TYPES.find((s) => s.id === selectedService)?.price || "0").replace(/[^0-9]/g, ""))}
                </span>
              </div>
            </div>

            {/* AI 预约助手 */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Sparkles className="w-3.5 h-3.5" /> AI 预约助手 · 建议与注意事项
              </div>
              {aiAdviceLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> AI 正在为你准备贴心建议…
                </div>
              ) : aiAdviceText ? (
                <div className="prose prose-sm max-w-none text-foreground [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_strong]:text-primary">
                  <ReactMarkdown>{aiAdviceText}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">提交前请核对宠物类型与备注 ☑️</p>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>
                返回修改
              </Button>
              <Button className="flex-1" onClick={proceedToPayment}>
                确认并支付
              </Button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

const ConfirmRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3">
    <span className="text-muted-foreground shrink-0">{label}</span>
    <span className="text-foreground text-right break-all">{value}</span>
  </div>
);

export default BookingPage;
