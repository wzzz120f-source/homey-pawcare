import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Copy, RefreshCw, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type ErrorKind = "address_search" | "route_planning" | "order_submit";

export interface ErrorReportItem {
  /** Stable category used to drive icon + i18n copy */
  kind: ErrorKind;
  /** Optional raw message returned by the failing system (Amap / Supabase / fetch) */
  detail?: string;
  /** Optional retry handler. When provided a "Retry" button is rendered. */
  onRetry?: () => void | Promise<void>;
  /** Disable the retry button (e.g. missing prerequisites) */
  retryDisabled?: boolean;
}

interface ErrorReportProps {
  items: ErrorReportItem[];
  className?: string;
  /** Optional additional context appended to the copyable details payload */
  context?: Record<string, unknown>;
}

const KIND_TO_KEY: Record<ErrorKind, { label: string; hint: string }> = {
  address_search: { label: "errors.addressSearch.label", hint: "errors.addressSearch.hint" },
  route_planning: { label: "errors.routePlanning.label", hint: "errors.routePlanning.hint" },
  order_submit: { label: "errors.orderSubmit.label", hint: "errors.orderSubmit.hint" },
};

const ErrorReport = ({ items, className, context }: ErrorReportProps) => {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copyText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`# ${t("errors.title")}`);
    lines.push(`time: ${new Date().toISOString()}`);
    lines.push(`lang: ${i18n.resolvedLanguage || i18n.language}`);
    if (typeof navigator !== "undefined") {
      lines.push(`ua: ${navigator.userAgent}`);
    }
    items.forEach((it, idx) => {
      lines.push("");
      lines.push(`## [${idx + 1}] ${t(KIND_TO_KEY[it.kind].label)} (${it.kind})`);
      if (it.detail) lines.push(`detail: ${it.detail}`);
    });
    if (context && Object.keys(context).length) {
      lines.push("");
      lines.push("## context");
      try {
        lines.push(JSON.stringify(context, null, 2));
      } catch {
        lines.push(String(context));
      }
    }
    return lines.join("\n");
  }, [items, context, t, i18n]);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyText);
      } else {
        const ta = document.createElement("textarea");
        ta.value = copyText;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast.success(t("common.copied"));
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t("common.copyFailed"));
    }
  };

  if (!items.length) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="error-report"
      className={cn(
        "rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-destructive">{t("errors.title")}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            {t("errors.subtitle")}
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((it, idx) => (
          <li
            key={`${it.kind}-${idx}`}
            data-testid={`error-item-${it.kind}`}
            className="rounded-lg bg-card border border-border/70 p-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">
                {t(KIND_TO_KEY[it.kind].label)}
              </p>
              {it.onRetry && (
                <button
                  type="button"
                  onClick={() => void it.onRetry?.()}
                  disabled={it.retryDisabled}
                  data-testid={`error-retry-${it.kind}`}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold",
                    "bg-primary text-primary-foreground hover:opacity-90 transition-opacity",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "min-h-[28px]",
                  )}
                  aria-label={`${t("errors.retryAction")} — ${t(KIND_TO_KEY[it.kind].label)}`}
                >
                  <RefreshCw className="w-3 h-3" aria-hidden="true" />
                  {t("errors.retryAction")}
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              {t(KIND_TO_KEY[it.kind].hint)}
            </p>
            {it.detail && (
              <p
                className="mt-1 text-[10px] font-mono text-destructive/80 bg-destructive/5 rounded px-1.5 py-1 break-all"
                data-testid={`error-detail-${it.kind}`}
              >
                {it.detail}
              </p>
            )}
          </li>
        ))}
      </ul>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={handleCopy}
          data-testid="copy-error-details"
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full",
            "bg-card border border-border hover:bg-secondary transition-colors min-h-[28px]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          )}
          aria-label={t("errors.copyDetails")}
        >
          {copied ? (
            <Check className="w-3 h-3 text-emerald-600" aria-hidden="true" />
          ) : (
            <Copy className="w-3 h-3" aria-hidden="true" />
          )}
          {t("errors.copyDetails")}
        </button>
      </div>
    </div>
  );
};

export default ErrorReport;
