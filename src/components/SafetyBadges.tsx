import { useTranslation } from "react-i18next";
import {
  ShieldCheck,
  BadgeCheck,
  GraduationCap,
  Video,
  UserCheck,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSafetyBadges } from "@/hooks/useSafetyData";

const ICON_MAP: Record<string, LucideIcon> = {
  "shield-check": ShieldCheck,
  "badge-check": BadgeCheck,
  "graduation-cap": GraduationCap,
  video: Video,
  "user-check": UserCheck,
  shield: Shield,
};

/**
 * 首页五重安全保障 — 数据来自 safety_badges 表，支持中英文。
 * 视觉上使用 warm-gradient + 爪印水印强化品牌。
 */
const SafetyBadges = () => {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const { data, isLoading } = useSafetyBadges();

  const heading = isEn ? "5-Layer Safety Promise" : "五重安全保障";
  const subtitle = isEn
    ? "Every visit is verified, insured & recorded"
    : "每一次上门，都让你安心托付";

  return (
    <section
      aria-label={heading}
      className="relative mx-4 mt-6 overflow-hidden rounded-2xl border border-primary/15 warm-gradient p-4 shadow-sm"
    >
      {/* 爪印水印背景 */}
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        className="pointer-events-none absolute -right-4 -bottom-4 h-32 w-32 text-primary/10"
        fill="currentColor"
      >
        <circle cx="30" cy="35" r="9" />
        <circle cx="55" cy="22" r="9" />
        <circle cx="78" cy="38" r="9" />
        <ellipse cx="55" cy="65" rx="22" ry="18" />
      </svg>

      <header className="relative mb-3 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-extrabold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            {heading}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </header>

      <ul className="relative grid grid-cols-5 gap-1.5" role="list">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex flex-col items-center gap-1.5">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-3 w-12" />
              </li>
            ))
          : (data ?? []).slice(0, 5).map((b) => {
              const Icon = ICON_MAP[b.icon] || Shield;
              const title = isEn && b.title_en ? b.title_en : b.title;
              const desc = isEn && b.description_en ? b.description_en : b.description;
              return (
                <li
                  key={b.id}
                  className="group flex flex-col items-center gap-1.5 text-center"
                  title={desc}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-primary shadow-sm ring-1 ring-primary/20 transition-transform group-hover:-translate-y-0.5"
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[10px] font-semibold leading-tight text-foreground line-clamp-2">
                    {title}
                  </span>
                </li>
              );
            })}
      </ul>
    </section>
  );
};

export default SafetyBadges;
