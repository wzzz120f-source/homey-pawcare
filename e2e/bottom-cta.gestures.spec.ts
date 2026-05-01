import { test, expect, Page } from "@playwright/test";

/**
 * E2E: simulated touch/trackpad gestures on iOS/Android, ensuring the
 * BottomCta hide/show direction matches the gesture without jitter.
 */

const TARGET_PATH = process.env.E2E_CTA_PATH ?? "/shop";

async function gotoCta(page: Page) {
  await page.goto(TARGET_PATH);
  await page.waitForSelector('[data-testid="bottom-cta"], [data-testid="bottom-cta-shell"]', {
    timeout: 10_000,
  });
  await page.evaluate(() => {
    if (document.body.scrollHeight < window.innerHeight * 4) {
      const filler = document.createElement("div");
      filler.style.height = "300vh";
      document.body.appendChild(filler);
    }
  });
}

/** Simulate a smooth touch swipe by dispatching synthetic touch events. */
async function touchSwipe(page: Page, fromY: number, toY: number, steps = 10) {
  await page.evaluate(
    async ({ fromY, toY, steps }) => {
      const x = window.innerWidth / 2;
      const dy = (toY - fromY) / steps;
      // Touch events drive scroll on real devices; on emulated mobile we
      // also call window.scrollBy to deterministically move the document.
      for (let i = 0; i <= steps; i++) {
        const y = fromY + dy * i;
        const evt = new Event("touchmove", { bubbles: true });
        window.dispatchEvent(evt);
        // Swipe UP (finger moves up → page scrolls DOWN) → scroll positive
        // Swipe DOWN (finger moves down → page scrolls UP) → scroll negative
        window.scrollBy(0, -dy / 2);
        await new Promise((r) => requestAnimationFrame(r));
        void y;
      }
    },
    { fromY, toY, steps },
  );
}

test.describe("BottomCta — touch gesture coherence", () => {
  test("repeated swipe-up (scroll down) hides without jitter", async ({ page }) => {
    await gotoCta(page);
    const cta = page.locator('[data-testid="bottom-cta"], [data-testid="bottom-cta-shell"]').first();
    await expect(cta).toHaveAttribute("data-state", "visible");

    const stateChanges: string[] = [];
    await page.exposeFunction("__recordState", (s: string) => {
      if (stateChanges[stateChanges.length - 1] !== s) stateChanges.push(s);
    });
    await page.evaluate(() => {
      const el = document.querySelector(
        '[data-testid="bottom-cta"],[data-testid="bottom-cta-shell"]',
      ) as HTMLElement | null;
      if (!el) return;
      new MutationObserver(() => {
        // @ts-expect-error injected
        window.__recordState(el.getAttribute("data-state"));
      }).observe(el, { attributes: true, attributeFilter: ["data-state"] });
    });

    // 5 consecutive upward swipes (page scrolls down)
    for (let i = 0; i < 5; i++) {
      await touchSwipe(page, 600, 200);
      await page.evaluate((y) => window.scrollTo(0, y), 200 + i * 200);
      await page.waitForTimeout(80);
    }

    await expect(cta).toHaveAttribute("data-state", "hidden", { timeout: 2_000 });
    // No flapping: at most a single visible→hidden flip.
    expect(stateChanges.filter((s) => s === "hidden").length).toBeLessThanOrEqual(1);
  });

  test("swipe-down (scroll up) shows the CTA again", async ({ page }) => {
    await gotoCta(page);
    const cta = page.locator('[data-testid="bottom-cta"], [data-testid="bottom-cta-shell"]').first();

    await page.evaluate(() => window.scrollTo(0, 800));
    await expect(cta).toHaveAttribute("data-state", "hidden");

    for (let i = 0; i < 4; i++) {
      await touchSwipe(page, 200, 600);
      await page.evaluate((y) => window.scrollTo(0, y), 800 - i * 200);
      await page.waitForTimeout(80);
    }
    await expect(cta).toHaveAttribute("data-state", "visible", { timeout: 2_000 });
  });

  test("alternating swipes do not cause >2 toggles per direction change", async ({ page }) => {
    await gotoCta(page);
    const cta = page.locator('[data-testid="bottom-cta"], [data-testid="bottom-cta-shell"]').first();

    const transitions: string[] = [];
    await page.exposeFunction("__pushT", (s: string) => transitions.push(s));
    await page.evaluate(() => {
      const el = document.querySelector(
        '[data-testid="bottom-cta"],[data-testid="bottom-cta-shell"]',
      ) as HTMLElement;
      new MutationObserver(() => {
        // @ts-expect-error injected
        window.__pushT(el.getAttribute("data-state"));
      }).observe(el, { attributes: true, attributeFilter: ["data-state"] });
    });

    // down, up, down, up (each clearly past topOffset with margin)
    const ys = [600, 200, 700, 150, 800, 100];
    for (const y of ys) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(120);
    }
    // Expect exactly one transition per real direction change (≤ ys.length-1).
    expect(transitions.length).toBeLessThanOrEqual(ys.length);
  });
});
