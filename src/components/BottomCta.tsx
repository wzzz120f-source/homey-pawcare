import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useScrollHidden } from "@/hooks/useScrollDirection";

interface BottomCtaProps extends HTMLAttributes<HTMLDivElement> {
  /** Distance from screen bottom in tailwind units. Default 16 (above BottomNav). Use 0 for pages without BottomNav. */
  offset?: "above-nav" | "bottom" | "above-nav-lg";
  /** Force hidden state externally (overrides scroll). */
  forceHidden?: boolean;
  /** Disable auto-hide on scroll. */
  disableAutoHide?: boolean;
}

/**
 * Unified fixed bottom CTA container.
 * - Auto hides on scroll-down, shows on scroll-up (respects prefers-reduced-motion).
 * - Consistent rounded corners, border, and safe-area padding across screen widths.
 */
export const BottomCta = forwardRef<HTMLDivElement, BottomCtaProps>(
  ({ className, children, offset = "above-nav", forceHidden, disableAutoHide, ...rest }, ref) => {
    const autoHidden = useScrollHidden();
    const hidden = forceHidden ?? (disableAutoHide ? false : autoHidden);

    const offsetClass =
      offset === "bottom"
        ? "bottom-0"
        : offset === "above-nav-lg"
          ? "bottom-20"
          : "bottom-16";

    return (
      <div
        ref={ref}
        role="region"
        aria-label="底部操作栏"
        aria-hidden={hidden}
        className={cn(
          "fixed left-0 right-0 z-30 px-2 sm:px-4 pointer-events-none",
          offsetClass,
          "transition-transform duration-300 ease-out motion-reduce:transition-none",
          hidden ? "translate-y-[120%]" : "translate-y-0",
        )}
      >
        <div
          className={cn(
            "pointer-events-auto mx-auto max-w-lg",
            "bg-background/95 backdrop-blur-md border border-border/60 rounded-2xl shadow-lg",
            "px-4 py-3",
            "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
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
