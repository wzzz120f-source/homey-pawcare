import {
  forwardRef,
  HTMLAttributes,
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

/**
 * SafeAreaBottomLayout
 * --------------------
 * 统一处理“页面有底部固定栏”时的两件事：
 *  1) 底栏自身：padding-bottom 叠加 env(safe-area-inset-bottom)。
 *  2) 主体内容：自动测量底栏高度并在主体末尾留出等高 spacer，
 *     避免最后一项被结算条压住。
 *
 * SSR / 首屏策略
 * ----------------
 * - 初始 spacer 高度使用 `estimatedBarHeightPx`（默认 72px），
 *   保证 SSR 与客户端首帧一致，避免 hydration 不匹配 / 高度闪动。
 * - `useLayoutEffect` 在浏览器端首帧后立即测量真实高度，比
 *   `useEffect` 更早，避免出现「先 0 后跳变」的视觉抖动。
 * - 测量结果会与估算值进行 max() 兜底，spacer 只增不减，避免在底栏
 *   高度异步变化（图片加载、字体延迟）时反复抖动。
 * - 测量加入容错：高度 < 16px 视为未就绪（例如 display:none），
 *   保留估算值；测量失败时回退到估算值。
 */

const isBrowser = typeof window !== "undefined";
const useIsoLayoutEffect = isBrowser ? useLayoutEffect : useEffect;

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
  /**
   * SSR / 首屏估算高度（px）。在真实测量到来前，spacer 会用这个高度，
   * 避免出现 0px → N px 的高度跳变。建议参考实际底栏视觉高度，
   * 默认为 72px（按钮 + 内边距）。
   */
  estimatedBarHeightPx?: number;
  /** 测试用 testid。 */
  "data-testid"?: string;
}

const NAV_HEIGHT_PX = 64; // 与 BottomNav h-16 一致
const MIN_VALID_BAR_PX = 16;

export const SafeAreaBottomLayout = forwardRef<HTMLDivElement, SafeAreaBottomLayoutProps>(
  (
    {
      bottomBar,
      bottomBarClassName,
      reserveBottomSpace = true,
      extraReservePx = 8,
      aboveBottomNav = false,
      estimatedBarHeightPx = 72,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    const barRef = useRef<HTMLDivElement | null>(null);
    // 初始值用估算高度，保证 SSR 与首帧一致、无闪动。
    const [barHeight, setBarHeight] = useState<number>(estimatedBarHeightPx);

    const measure = useCallback(() => {
      const el = barRef.current;
      if (!el) return;
      try {
        const h = el.getBoundingClientRect().height;
        if (Number.isFinite(h) && h >= MIN_VALID_BAR_PX) {
          // spacer 只增不减，避免抖动
          setBarHeight((prev) => (h > prev ? h : prev));
        }
      } catch {
        /* noop — 测量失败时保留旧值/估算值 */
      }
    }, []);

    useIsoLayoutEffect(() => {
      if (!bottomBar) return;
      measure();
    }, [bottomBar, measure]);

    useEffect(() => {
      if (!bottomBar || !barRef.current) return;
      const el = barRef.current;
      // 字体/图片加载完成后再测一次
      const raf = requestAnimationFrame(measure);
      let ro: ResizeObserver | undefined;
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => measure());
        ro.observe(el);
      }
      window.addEventListener("resize", measure);
      window.addEventListener("orientationchange", measure);
      // 字体异步加载完成后重新测量
      const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
      fonts?.ready?.then(() => measure()).catch(() => undefined);
      return () => {
        cancelAnimationFrame(raf);
        ro?.disconnect();
        window.removeEventListener("resize", measure);
        window.removeEventListener("orientationchange", measure);
      };
    }, [bottomBar, measure]);

    const reservePx = bottomBar && reserveBottomSpace ? Math.ceil(barHeight) + extraReservePx : 0;

    return (
      <div ref={ref} className={cn("relative", className)} {...rest}>
        {children}
        {reservePx > 0 && (
          <div
            aria-hidden="true"
            data-testid="safe-area-spacer"
            data-bar-height={Math.ceil(barHeight)}
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
            className={cn("fixed left-0 right-0 z-30", bottomBarClassName)}
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
