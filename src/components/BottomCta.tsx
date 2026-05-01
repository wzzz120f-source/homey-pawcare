import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useScrollHidden } from "@/hooks/useScrollDirection";

interface BottomCtaProps extends HTMLAttributes<HTMLDivElement> {
  /** Distance from screen bottom. Default 16 (above BottomNav). */
  offset?: "above-nav" | "bottom" | "above-nav-lg";
  forceHidden?: boolean;
  disableAutoHide?: boolean;
}

/**
 * Unified safe-area padding: max(0.75rem, safe-area-inset-bottom).
 * Spring-like easing (cubic-bezier with overshoot) for inertial feel.
 * Reduced-motion: no transition.
 */
const SAFE_AREA_PB = "pb-[max(0.75rem,env(safe-area-inset-bottom))]";
const SPRING_TRANSITION =
  "transition-transform duration-[420ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none motion-reduce:duration-0";

export const BottomCta = forwardRef<HTMLDivElement, BottomCtaProps>(
  ({ className, children, offset = "above-nav", forceHidden, disableAutoHide, ...rest }, ref) => {
    const autoHidden = useScrollHidden();
    const hidden = forceHidden ?? (disableAutoHide ? false : autoHidden);

    const offsetClass =
      offset === "bottom" ? "bottom-0" : offset === "above-nav-lg" ? "bottom-20" : "bottom-16";

    return (
      <div
        ref={ref}
        role="region"
        aria-label="底部操作栏"
        aria-hidden={hidden}
        data-state={hidden ? "hidden" : "visible"}
        className={cn(
          "fixed left-0 right-0 z-30 px-2 sm:px-4 pointer-events-none",
          offsetClass,
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

/**
 * Raw shell: full-width fixed bar with auto-hide + safe-area, but no inner card.
 * Shares identical safe-area + spring animation with BottomCta.
 */
export const BottomCtaShell = forwardRef<HTMLDivElement, BottomCtaProps>(
  ({ className, children, offset = "above-nav", forceHidden, disableAutoHide, ...rest }, ref) => {
    const autoHidden = useScrollHidden();
    const hidden = forceHidden ?? (disableAutoHide ? false : autoHidden);

    const offsetClass =
      offset === "bottom" ? "bottom-0" : offset === "above-nav-lg" ? "bottom-20" : "bottom-16";

    return (
      <div
        ref={ref}
        role="region"
        aria-label="底部操作栏"
        aria-hidden={hidden}
        data-state={hidden ? "hidden" : "visible"}
        className={cn(
          "fixed left-0 right-0 z-30",
          offsetClass,
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
