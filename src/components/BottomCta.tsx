import { forwardRef, HTMLAttributes, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useScrollHidden } from "@/hooks/useScrollDirection";

/**
 * Offset can be:
 *  - a preset string ("above-nav" | "bottom" | "above-nav-lg")
 *  - "auto-nav" / "auto-no-nav": choose preset by page layout
 *  - a number (px) → arbitrary distance from viewport bottom
 *  - a CSS length string (e.g. "5rem", "calc(4rem + 8px)")
 */
export type BottomCtaOffset =
  | "above-nav"
  | "above-nav-lg"
  | "bottom"
  | "auto-nav"
  | "auto-no-nav"
  | number
  | string;

interface BottomCtaProps extends HTMLAttributes<HTMLDivElement> {
  offset?: BottomCtaOffset;
  /** Override page-level nav presence detection for "auto-*". */
  hasBottomNav?: boolean;
  forceHidden?: boolean;
  disableAutoHide?: boolean;
}

const SAFE_AREA_PB = "pb-[max(0.75rem,env(safe-area-inset-bottom))]";
const SPRING_TRANSITION =
  "transition-transform duration-[420ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none motion-reduce:duration-0";

const PRESET_CLASS: Record<string, string> = {
  "above-nav": "bottom-16",
  "above-nav-lg": "bottom-20",
  bottom: "bottom-0",
};

function detectHasBottomNav(): boolean {
  if (typeof document === "undefined") return true;
  return !!document.querySelector("[data-bottom-nav]");
}

function resolveOffset(
  offset: BottomCtaOffset,
  hasBottomNav: boolean | undefined,
): { className?: string; style?: React.CSSProperties } {
  if (typeof offset === "number") {
    return { style: { bottom: `${offset}px` } };
  }
  if (typeof offset === "string" && !(offset in PRESET_CLASS) && !offset.startsWith("auto")) {
    // arbitrary CSS length
    return { style: { bottom: offset } };
  }
  if (offset === "auto-nav" || offset === "auto-no-nav") {
    const navPresent = hasBottomNav ?? detectHasBottomNav();
    return { className: navPresent ? PRESET_CLASS["above-nav"] : PRESET_CLASS["bottom"] };
  }
  return { className: PRESET_CLASS[offset as string] ?? PRESET_CLASS["above-nav"] };
}

export const BottomCta = forwardRef<HTMLDivElement, BottomCtaProps>(
  (
    { className, children, offset = "above-nav", hasBottomNav, forceHidden, disableAutoHide, ...rest },
    ref,
  ) => {
    const autoHidden = useScrollHidden();
    const hidden = forceHidden ?? (disableAutoHide ? false : autoHidden);
    const resolved = useMemo(() => resolveOffset(offset, hasBottomNav), [offset, hasBottomNav]);

    return (
      <div
        ref={ref}
        role="region"
        aria-label="底部操作栏"
        aria-hidden={hidden}
        data-state={hidden ? "hidden" : "visible"}
        data-testid="bottom-cta"
        style={resolved.style}
        className={cn(
          "fixed left-0 right-0 z-30 px-2 sm:px-4 pointer-events-none",
          resolved.className,
          SPRING_TRANSITION,
          hidden ? "translate-y-[140%]" : "translate-y-0",
        )}
      >
        <div
          className={cn(
            "pointer-events-auto mx-auto max-w-lg",
            "bg-background/95 backdrop-blur-md border border-border/60 rounded-2xl shadow-lg",
            "px-4 py-3",
            SAFE_AREA_PB,
            className,
          )}
          {...rest}
        >
          {children}
        </div>
      </div>
    );
  },
);
BottomCta.displayName = "BottomCta";

export const BottomCtaShell = forwardRef<HTMLDivElement, BottomCtaProps>(
  (
    { className, children, offset = "above-nav", hasBottomNav, forceHidden, disableAutoHide, ...rest },
    ref,
  ) => {
    const autoHidden = useScrollHidden();
    const hidden = forceHidden ?? (disableAutoHide ? false : autoHidden);
    const resolved = useMemo(() => resolveOffset(offset, hasBottomNav), [offset, hasBottomNav]);

    return (
      <div
        ref={ref}
        role="region"
        aria-label="底部操作栏"
        aria-hidden={hidden}
        data-state={hidden ? "hidden" : "visible"}
        data-testid="bottom-cta-shell"
        style={resolved.style}
        className={cn(
          "fixed left-0 right-0 z-30",
          resolved.className,
          SPRING_TRANSITION,
          hidden ? "translate-y-[140%]" : "translate-y-0",
          SAFE_AREA_PB,
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
BottomCtaShell.displayName = "BottomCtaShell";
