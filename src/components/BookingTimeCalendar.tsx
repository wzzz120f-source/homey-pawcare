import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIME_SLOTS } from "@/config/booking";

interface Props {
  date?: Date;
  selectedTime?: string;
  onChange: (time: string) => void;
  /** 已被预约满的时段（基于日期 hash 模拟） */
  bookedSlots?: string[];
  /** 当前时刻起需要的最小预约缓冲（分钟），默认 60 */
  leadTimeMinutes?: number;
  /** 当点击「最近可用日期」时回调 */
  onJumpToDate?: (date: Date) => void;
}

/** 生成给定日期的可预约状态 */
export const computeSlotStatus = (
  date: Date,
  bookedSlots: string[] | undefined,
  leadTimeMinutes: number,
  now: Date,
): { full: Set<string>; pastCutoff: Set<string> } => {
  // 占用 mock
  const seed = date.getFullYear() * 372 + (date.getMonth() + 1) * 31 + date.getDate();
  const fullArr =
    bookedSlots ??
    TIME_SLOTS.filter((_, i) => ((seed * 9301 + i * 49297) % 233280) % 4 === 0);
  const full = new Set<string>(fullArr);

  // 当前时刻 + 缓冲
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const isPast = date.setHours(0, 0, 0, 0) < new Date(now).setHours(0, 0, 0, 0);
  const cutoff = new Date(now.getTime() + leadTimeMinutes * 60_000);

  const pastCutoff = new Set<string>();
  if (isPast) {
    TIME_SLOTS.forEach((s) => pastCutoff.add(s));
  } else if (sameDay) {
    TIME_SLOTS.forEach((s) => {
      const [h, m] = s.split(":").map(Number);
      const slotDate = new Date(now);
      slotDate.setHours(h, m, 0, 0);
      if (slotDate.getTime() < cutoff.getTime()) pastCutoff.add(s);
    });
  }
  return { full, pastCutoff };
};

const BookingTimeCalendar = ({
  date,
  selectedTime,
  onChange,
  bookedSlots,
  leadTimeMinutes = 60,
  onJumpToDate,
}: Props) => {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const now = useMemo(() => new Date(), []);

  const { full, pastCutoff } = useMemo(() => {
    if (!date) return { full: new Set<string>(), pastCutoff: new Set<string>() };
    return computeStatus(new Date(date), bookedSlots, leadTimeMinutes, now);
  }, [date, bookedSlots, leadTimeMinutes, now]);

  // 当前日期完全无可用 → 找最近一个可用日期（往后搜索 7 天）
  const allUnavailable =
    !!date &&
    TIME_SLOTS.every((s) => full.has(s) || pastCutoff.has(s));

  const nearestAvailable = useMemo(() => {
    if (!allUnavailable || !date) return null;
    for (let i = 1; i <= 7; i++) {
      const candidate = new Date(date);
      candidate.setDate(candidate.getDate() + i);
      const { full: f, pastCutoff: p } = computeStatus(new Date(candidate), bookedSlots, leadTimeMinutes, now);
      const firstSlot = TIME_SLOTS.find((s) => !f.has(s) && !p.has(s));
      if (firstSlot) return { date: candidate, slot: firstSlot };
    }
    return null;
  }, [allUnavailable, date, bookedSlots, leadTimeMinutes, now]);

  const isFull = (slot: string) => full.has(slot);
  const isPastSlot = (slot: string) => pastCutoff.has(slot);

  return (
    <div className="space-y-2">
      {/* 当日规则提示 */}
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3" />
        {isEn
          ? `Bookable from ${leadTimeMinutes} min after now.`
          : `仅可预约自当前时刻 ${leadTimeMinutes} 分钟后的时段`}
      </div>

      <div
        className="grid grid-cols-3 gap-2"
        role="radiogroup"
        aria-label={isEn ? "Available time slots" : "可预约时段"}
      >
        {TIME_SLOTS.map((slot) => {
          const past = isPastSlot(slot);
          const fullBooked = isFull(slot);
          const disabled = past || fullBooked;
          const active = selectedTime === slot && !disabled;
          const reason = past
            ? (isEn ? "Past" : "已过")
            : fullBooked
              ? (isEn ? "Full" : "已满")
              : "";
          return (
            <button
              key={slot}
              type="button"
              role="radio"
              aria-checked={active}
              aria-disabled={disabled}
              disabled={disabled}
              onClick={() => !disabled && onChange(slot)}
              className={cn(
                "relative h-11 rounded-xl border text-sm font-semibold transition-all min-h-[44px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                disabled && "cursor-not-allowed bg-muted/50 text-muted-foreground/50 line-through border-dashed",
                !disabled && !active && "bg-card hover:border-primary/50 hover:bg-primary/5 border-border",
                active && "border-primary bg-primary text-primary-foreground shadow-md",
              )}
            >
              {slot}
              {disabled && (
                <span className="absolute right-1 top-0.5 text-[9px] font-medium text-muted-foreground">
                  {reason}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 无可用时段 → 引导跳转 */}
      {allUnavailable && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-dashed border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs space-y-2"
        >
          <p className="font-semibold text-amber-700 dark:text-amber-400">
            {isEn ? "No available slots today" : "当天暂无可预约时段"}
          </p>
          {nearestAvailable ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-foreground">
                {isEn ? "Next available:" : "最近可约："}{" "}
                <span className="font-mono">
                  {nearestAvailable.date.toLocaleDateString(isEn ? "en-US" : "zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                  })}{" "}
                  {nearestAvailable.slot}
                </span>
              </span>
              {onJumpToDate && (
                <button
                  type="button"
                  onClick={() => {
                    onJumpToDate(nearestAvailable.date);
                    onChange(nearestAvailable.slot);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 min-h-[36px]"
                >
                  {isEn ? "Jump" : "前往"} <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">
              {isEn ? "No available slots in the next 7 days. Please contact support." : "未来 7 天均已约满，请联系客服安排。"}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default BookingTimeCalendar;
