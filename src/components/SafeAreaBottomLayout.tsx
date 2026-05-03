import { forwardRef, HTMLAttributes, ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * SafeAreaBottomLayout
 * --------------------
 * 统一处理“页面有底部固定栏”时的两件事：
 *  1) 底栏自身：padding-bottom 叠加 env(safe-area-inset-bottom)，
 *     适配 iPhone 全面屏小横条 / Android 手势区，避免按钮被压住。
 *  2) 主体内容：自动测量底栏高度并在主体末尾留出等高的 spacer，
 *     保证滚动到底时最后一项能完整露出，而不是被结算条压住一半。
 *
 * 这是一个高层布局封装；如果只需要漂浮 CTA（带显隐动画），
 * 仍然可以使用 `<BottomCta>` / `<BottomCtaShell>`。
 *
 * 用法：
 *   <SafeAreaBottomLayout
 *     bottomBar={<MyFooter />}
 *     bottomBarClassName="bg-background border-t"
 *   >
 *     <main>...long list...</main>
 *   </SafeAreaBottomLayout>
 */

export interface SafeAreaBottomLayoutProps extends HTMLAttributes<HTMLDivElement> {
  /** 底部固定栏内容；不传则纯做主体 padding 处理。 */
  bottomBar?: ReactNode;
  /** 底栏外层附加类（控制背景、边框、最大宽度等）。 */
  bottomBarClassName?: string;
  /** 是否在主体末尾插入等高 spacer。默认 true。 */
  reserveBottomSpace?: boolean;
  /** 在测量值之外额外预留的像素，默认 8。 */
  extraReservePx?: number;
  /** 全局 BottomNav 是否存在；用于让底栏停在 nav 上方。 */
  aboveBottomNav?: boolean;
  /** 测试用 testid。 */
  "data-testid"?: string;
}

const NAV_HEIGHT_PX = 64; // 与 BottomNav 高度保持一致（h-16）

export const SafeAreaBottomLayout = forwardRef<HTMLDivElement, SafeAreaBottomLayoutProps>(
  (
    {
      bottomBar,
      bottomBarClassName,
      reserveBottomSpace = true,
      extraReservePx = 8,
      aboveBottomNav = false,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    const barRef = useRef<HTMLDivElement | null>(null);
    const [barHeight, setBarHeight] = useState(0);

    useEffect(() => {
      if (!barRef.current || !bottomBar) return;
      const el = barRef.current;
      const update = () => setBarHeight(el.getBoundingClientRect().height);
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      window.addEventListener("resize", update);
      return () => {
        ro.disconnect();
        window.removeEventListener("resize", update);
      };
    }, [bottomBar]);

    const reservePx = bottomBar && reserveBottomSpace ? Math.ceil(barHeight) + extraReservePx : 0;

    return (
      <div ref={ref} className={cn("relative", className)} {...rest}>
        {children}
        {reservePx > 0 && (
          <div
            aria-hidden="true"
            data-testid="safe-area-spacer"
            style={{ height: `calc(${reservePx}px + env(safe-area-inset-bottom))` }}
          />
        )}
        {bottomBar && (
          <div
            ref={barRef}
            data-testid={rest["data-testid"] ? `${rest["data-testid"]}-bar` : "safe-area-bottom-bar"}
            data-safe-area-bottom-bar=""
            style={{
              bottom: aboveBottomNav ? `${NAV_HEIGHT_PX}px` : 0,
              paddingBottom: aboveBottomNav
                ? undefined
                : "max(0.5rem, env(safe-area-inset-bottom))",
            }}
            className={cn(
              "fixed left-0 right-0 z-30",
              bottomBarClassName,
            )}
          >
            {bottomBar}
          </div>
        )}
      </div>
    );
  },
);
SafeAreaBottomLayout.displayName = "SafeAreaBottomLayout";

export default SafeAreaBottomLayout;
