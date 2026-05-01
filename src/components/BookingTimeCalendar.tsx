import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { TIME_SLOTS } from "@/config/booking";

interface Props {
  date?: Date;
  selectedTime?: string;
  onChange: (time: string) => void;
  /** 已被预约满的时段（基于日期 hash 模拟，真实上线由后端给出） */
  bookedSlots?: string[];
}

/**
 * 日历式时间选择 — 灰色显示已约满时段，避免反复试错。
 * 当未传 bookedSlots 时使用 deterministic mock，让同一天显示一致。
 */
const BookingTimeCalendar = ({ date, selectedTime, onChange, bookedSlots }: Props) => {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");

  const fullSlots = useMemo<string[]>(() => {
    if (bookedSlots) return bookedSlots;
    if (!date) return [];
    // 用日期 + 时段索引生成稳定 hash,大约 25% 时段被占用
    const seed = date.getFullYear() * 372 + (date.getMonth() + 1) * 31 + date.getDate();
    return TIME_SLOTS.filter((_, i) => ((seed * 9301 + i * 49297) % 233280) % 4 === 0);
  }, [date, bookedSlots]);

  const isFull = (slot: string) => fullSlots.includes(slot);

  return (
    <div
      className="grid grid-cols-3 gap-2"
      role="radiogroup"
      aria-label={isEn ? "Available time slots" : "可预约时段"}
    >
      {TIME_SLOTS.map((slot) => {
        const full = isFull(slot);
        const active = selectedTime === slot && !full;
        return (
          <button
            key={slot}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={full}
            onClick={() => !full && onChange(slot)}
            className={cn(
              "relative h-11 rounded-xl border text-sm font-semibold transition-all min-h-[44px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              full && "cursor-not-allowed bg-muted/50 text-muted-foreground/50 line-through border-dashed",
              !full && !active && "bg-card hover:border-primary/50 hover:bg-primary/5 border-border",
              active && "border-primary bg-primary text-primary-foreground shadow-md",
            )}
          >
            {slot}
            {full && (
              <span className="absolute right-1 top-0.5 text-[9px] font-medium text-muted-foreground">
                {isEn ? "Full" : "已满"}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default BookingTimeCalendar;
