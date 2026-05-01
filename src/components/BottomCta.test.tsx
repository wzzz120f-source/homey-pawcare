import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { BottomCta, BottomCtaShell } from "./BottomCta";

function setMatchMedia(reduceMotion: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: reduceMotion && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, writable: true, configurable: true });
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
}

beforeEach(() => {
  setMatchMedia(false);
  Object.defineProperty(window, "scrollY", { value: 0, writable: true, configurable: true });
  // Run rAF synchronously
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0 as unknown as number;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BottomCta scroll behavior", () => {
  it("is visible by default (data-state=visible)", () => {
    render(<BottomCta>cta</BottomCta>);
    const region = screen.getByRole("region", { name: "底部操作栏" });
    expect(region.getAttribute("data-state")).toBe("visible");
    expect(region.getAttribute("aria-hidden")).toBe("false");
  });

  it("hides when scrolling DOWN past topOffset", () => {
    render(<BottomCta>cta</BottomCta>);
    scrollTo(200); // down
    const region = screen.getByRole("region");
    expect(region.getAttribute("data-state")).toBe("hidden");
    expect(region.className).toContain("translate-y-[140%]");
  });

  it("shows again when scrolling UP", () => {
    render(<BottomCta>cta</BottomCta>);
    scrollTo(300);
    expect(screen.getByRole("region").getAttribute("data-state")).toBe("hidden");
    scrollTo(200); // up by 100
    expect(screen.getByRole("region").getAttribute("data-state")).toBe("visible");
  });

  it("always shows near the top of page", () => {
    render(<BottomCta>cta</BottomCta>);
    scrollTo(500);
    scrollTo(10); // back to top
    expect(screen.getByRole("region").getAttribute("data-state")).toBe("visible");
  });

  it("respects prefers-reduced-motion: never auto-hides", () => {
    setMatchMedia(true);
    render(<BottomCta>cta</BottomCta>);
    scrollTo(800);
    expect(screen.getByRole("region").getAttribute("data-state")).toBe("visible");
  });

  it("forceHidden overrides scroll state", () => {
    render(<BottomCta forceHidden>cta</BottomCta>);
    expect(screen.getByRole("region").getAttribute("data-state")).toBe("hidden");
  });

  it("disableAutoHide keeps it visible while scrolling", () => {
    render(<BottomCta disableAutoHide>cta</BottomCta>);
    scrollTo(900);
    expect(screen.getByRole("region").getAttribute("data-state")).toBe("visible");
  });
});

describe("BottomCta offset variants", () => {
  it("default offset = above-nav (bottom-16)", () => {
    render(<BottomCta>cta</BottomCta>);
    expect(screen.getByRole("region").className).toContain("bottom-16");
  });

  it("offset=bottom uses bottom-0", () => {
    render(<BottomCta offset="bottom">cta</BottomCta>);
    expect(screen.getByRole("region").className).toContain("bottom-0");
  });

  it("offset=above-nav-lg uses bottom-20", () => {
    render(<BottomCta offset="above-nav-lg">cta</BottomCta>);
    expect(screen.getByRole("region").className).toContain("bottom-20");
  });
});

describe("BottomCta animation tokens", () => {
  it("uses spring cubic-bezier transition", () => {
    render(<BottomCta>cta</BottomCta>);
    const cls = screen.getByRole("region").className;
    expect(cls).toContain("ease-[cubic-bezier(0.34,1.56,0.64,1)]");
    expect(cls).toContain("motion-reduce:transition-none");
  });
});

describe("BottomCtaShell", () => {
  it("applies unified safe-area padding", () => {
    render(<BottomCtaShell>shell</BottomCtaShell>);
    const region = screen.getByRole("region");
    expect(region.className).toContain("pb-[max(0.75rem,env(safe-area-inset-bottom))]");
  });

  it("hides on scroll down and shows on scroll up", () => {
    render(<BottomCtaShell>shell</BottomCtaShell>);
    scrollTo(250);
    expect(screen.getByRole("region").getAttribute("data-state")).toBe("hidden");
    scrollTo(150);
    expect(screen.getByRole("region").getAttribute("data-state")).toBe("visible");
  });
});
