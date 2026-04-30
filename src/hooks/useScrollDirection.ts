import { useEffect, useState } from "react";

/**
 * Returns true when user is scrolling DOWN (CTA should hide),
 * false when scrolling UP or near top (CTA should show).
 */
export function useScrollHidden(threshold = 8, topOffset = 80): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      // Respect reduced motion: never hide.
      return;
    }

    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      const y = window.scrollY;
      const dy = y - lastY;

      if (y < topOffset) {
        setHidden(false);
      } else if (Math.abs(dy) > threshold) {
        setHidden(dy > 0);
      }
      lastY = y;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold, topOffset]);

  return hidden;
}
