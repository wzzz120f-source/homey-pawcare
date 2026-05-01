import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useRef } from "react";
import { BottomCta } from "./BottomCta";

let rafQueue: FrameRequestCallback[] = [];

function flushRaf() {
  const queue = rafQueue;
  rafQueue = [];
  queue.forEach((cb) => cb(0));
}

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, writable: true, configurable: true });
  act(() => {
    window.dispatchEvent(new Event("scroll"));
    flushRaf();
  });
}

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
  Object.defineProperty(window, "scrollY", { value: 0, writable: true, configurable: true });
  rafQueue = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length as unknown as number;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function CountingCta() {
  const renders = useRef(0);
  renders.current += 1;
  return (
    <BottomCta>
      <span data-testid="render-count">{renders.current}</span>
    </BottomCta>
  );
}

describe("BottomCta performance regression", () => {
  it("rAF coalesces high-frequency scroll events (handler runs once per frame)", () => {
    render(<BottomCta>cta</BottomCta>);

    // Fire 200 scroll events without flushing rAF in between
    Object.defineProperty(window, "scrollY", { value: 500, writable: true, configurable: true });
    act(() => {
      for (let i = 0; i < 200; i++) {
        window.dispatchEvent(new Event("scroll"));
      }
    });

    // Only one rAF callback should be queued for the whole burst
    expect(rafQueue.length).toBe(1);
    act(() => flushRaf());
    expect(screen.getByTestId("bottom-cta").getAttribute("data-state")).toBe("hidden");
  });

  it("does not re-render when scroll direction state is unchanged", () => {
    render(<CountingCta />);
    const initial = Number(screen.getByTestId("render-count").textContent);

    // Many small downward scrolls past topOffset, all keep `hidden=true`
    for (let y = 200; y < 1000; y += 20) scrollTo(y);

    const after = Number(screen.getByTestId("render-count").textContent);
    // Expect at most 1 additional render (initial visible → hidden once)
    expect(after - initial).toBeLessThanOrEqual(1);
  });

  it("handles 500 scroll events under a generous time budget", () => {
    render(<BottomCta>cta</BottomCta>);
    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      scrollTo(i * 4);
    }
    const elapsed = performance.now() - start;
    // Generous budget for jsdom; flags catastrophic regressions only.
    expect(elapsed).toBeLessThan(1500);
  });
});

describe("BottomCta custom offset", () => {
  it("accepts a numeric offset (px)", () => {
    render(<BottomCta offset={96}>cta</BottomCta>);
    const el = screen.getByTestId("bottom-cta");
    expect(el.style.bottom).toBe("96px");
  });

  it("accepts an arbitrary CSS length string", () => {
    render(<BottomCta offset="5rem">cta</BottomCta>);
    expect(screen.getByTestId("bottom-cta").style.bottom).toBe("5rem");
  });

  it("auto-nav picks above-nav when bottom nav exists", () => {
    document.body.innerHTML = '<nav data-bottom-nav></nav>';
    render(<BottomCta offset="auto-nav">cta</BottomCta>);
    expect(screen.getByTestId("bottom-cta").className).toContain("bottom-16");
    document.body.innerHTML = "";
  });

  it("auto-no-nav falls back to bottom when no nav present", () => {
    document.body.innerHTML = "";
    render(<BottomCta offset="auto-no-nav">cta</BottomCta>);
    expect(screen.getByTestId("bottom-cta").className).toContain("bottom-0");
  });

  it("explicit hasBottomNav=false overrides DOM detection", () => {
    document.body.innerHTML = '<nav data-bottom-nav></nav>';
    render(
      <BottomCta offset="auto-nav" hasBottomNav={false}>
        cta
      </BottomCta>,
    );
    expect(screen.getByTestId("bottom-cta").className).toContain("bottom-0");
    document.body.innerHTML = "";
  });
});
