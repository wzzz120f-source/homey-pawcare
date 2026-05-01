import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  className?: string;
  /** Compact icon-only variant (e.g. inside a header) */
  compact?: boolean;
}

const LABELS: Record<SupportedLanguage, string> = { zh: "中文", en: "EN" };

const LanguageSwitcher = ({ className, compact = true }: LanguageSwitcherProps) => {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || "zh").slice(0, 2) as SupportedLanguage;

  const change = (lng: SupportedLanguage) => {
    if (lng === current) return;
    void i18n.changeLanguage(lng);
    try {
      document.documentElement.lang = lng === "zh" ? "zh-CN" : "en";
    } catch {
      /* SSR / non-browser noop */
    }
  };

  return (
    <div
      role="group"
      aria-label={t("common.language")}
      data-testid="language-switcher"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5",
        className,
      )}
    >
      {compact && <Globe className="w-3.5 h-3.5 text-muted-foreground ml-1.5" aria-hidden="true" />}
      {SUPPORTED_LANGUAGES.map((lng) => {
        const active = current === lng;
        return (
          <button
            key={lng}
            type="button"
            onClick={() => change(lng)}
            aria-pressed={active}
            data-testid={`lang-${lng}`}
            className={cn(
              "min-w-[36px] min-h-[28px] px-2 rounded-full text-[11px] font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary",
            )}
          >
            {LABELS[lng]}
          </button>
        );
      })}
    </div>
  );
};

export default LanguageSwitcher;
