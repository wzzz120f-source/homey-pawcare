// Unified draft + customer-service handoff helpers.
// Used by BookingPage and HotelDetailPage to:
//  - save a draft so the user can resume after AI/network failures,
//  - restore that draft on next page load,
//  - hand off to 人工客服 while preserving order/form context.

export const BOOKING_DRAFT_KEY = "booking_draft_v1";
export const HOTEL_DRAFT_KEY = "hotel_booking_draft_v1";
export const CS_HANDOFF_KEY = "cs_handoff_context_v1";

export interface BookingDraft {
  activeTab?: string;
  selectedPet?: string;
  selectedService?: string;
  selectedDate?: string; // ISO
  selectedTime?: string;
  selectedStore?: string;
  notes?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  selectedTier?: string;
  driverGender?: string;
  addInsurance?: boolean;
  addPhoto?: boolean;
  timeMode?: string;
  appliedPlanTitle?: string;
  savedAt?: string;
}

export interface HotelBookingDraft {
  hotelId?: string;
  hotelName?: string;
  hotelAddress?: string;
  bookingDate?: string;
  bookingNights?: number;
  bookingPetType?: string;
  bookingTimeSlot?: string;
  bookingNotes?: string;
  pickupMethod?: "self" | "pickup";
  pickupAddress?: string;
  savedAt?: string;
}

export interface HandoffContext {
  source: "booking" | "hotel" | "receipt";
  reason?: "ai_rate_limit" | "ai_credit" | "ai_offline" | "pdf_failed" | "manual";
  summary: string; // short human-readable summary shown to 客服
  payload?: Record<string, unknown>;
  savedAt: string;
}

function safeWrite(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function safeRead<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveBookingDraft(draft: BookingDraft): boolean {
  return safeWrite(BOOKING_DRAFT_KEY, { ...draft, savedAt: new Date().toISOString() });
}
export function loadBookingDraft(): BookingDraft | null {
  return safeRead<BookingDraft>(BOOKING_DRAFT_KEY);
}
export function clearBookingDraft() {
  try { localStorage.removeItem(BOOKING_DRAFT_KEY); } catch { /* ignore */ }
}

export function saveHotelDraft(draft: HotelBookingDraft): boolean {
  return safeWrite(HOTEL_DRAFT_KEY, { ...draft, savedAt: new Date().toISOString() });
}
export function loadHotelDraft(): HotelBookingDraft | null {
  return safeRead<HotelBookingDraft>(HOTEL_DRAFT_KEY);
}
export function clearHotelDraft() {
  try { localStorage.removeItem(HOTEL_DRAFT_KEY); } catch { /* ignore */ }
}

export function saveHandoffContext(ctx: Omit<HandoffContext, "savedAt">) {
  return safeWrite(CS_HANDOFF_KEY, { ...ctx, savedAt: new Date().toISOString() });
}
export function consumeHandoffContext(): HandoffContext | null {
  const ctx = safeRead<HandoffContext>(CS_HANDOFF_KEY);
  if (ctx) {
    try { localStorage.removeItem(CS_HANDOFF_KEY); } catch { /* ignore */ }
  }
  return ctx;
}

/**
 * Format a recent timestamp like "刚刚 / X 分钟前".
 */
export function formatSavedAt(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, Date.now() - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  return `${day} 天前`;
}
