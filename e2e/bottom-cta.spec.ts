import { test, expect, Page } from "@playwright/test";

/**
 * E2E: bottom CTA respects safe-area on iOS/Android and hides/shows on scroll.
 *
 * Routes containing a BottomCta in this app: /booking, /pet-hotel/:id,
 * /shop, /product/:id, /trip-rating/:id. We use /shop as a stable target
 * since it always renders a CTA bar on mobile widths.
 */

const TARGET_PATH = process.env.E2E_CTA_PATH ?? "/shop";

async function gotoCta(page: Page) {
  await page.goto(TARGET_PATH);
  await page.waitForSelector('[data-testid="bottom-cta"], [data-testid="bottom-cta-shell"]', {
    timeout: 10_000,
  });
}

async function ensureScrollable(page: Page) {
  // Inject filler to guarantee scrollable content even if page is short.
  await page.evaluate(() => {
    if (document.body.scrollHeight < window.innerHeight * 3) {
      const filler = document.createElement("div");
      filler.style.height = "200vh";
      filler.setAttribute("data-e2e-filler", "true");
      document.body.appendChild(filler);
    }
  });
}

test.describe("BottomCta — safe-area and scroll", () => {
  test("does not get clipped by the safe-area inset", async ({ page }) => {
    await gotoCta(page);

    const cta = page.locator('[data-testid="bottom-cta"], [data-testid="bottom-cta-shell"]').first();
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();

    const viewport = page.viewportSize()!;
    // CTA bottom edge must be within the viewport.
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);

    // Effective padding-bottom must be >= 12px (matches max(0.75rem, env(...))).
    const pb = await cta.evaluate(
      (el) => parseFloat(getComputedStyle(el as HTMLElement).paddingBottom) || 0,
    );
    expect(pb).toBeGreaterThanOrEqual(12);
  });

  test("hides on scroll down and shows on scroll up", async ({ page }) => {
    await gotoCta(page);
    await ensureScrollable(page);

    const cta = page.locator('[data-testid="bottom-cta"], [data-testid="bottom-cta-shell"]').first();
    await expect(cta).toHaveAttribute("data-state", "visible");

    // Scroll down past the topOffset (80px) by a comfortable margin.
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" as ScrollBehavior }));
    await expect(cta).toHaveAttribute("data-state", "hidden", { timeout: 2_000 });

    // Scroll back up.
    await page.evaluate(() => window.scrollTo({ top: 200, behavior: "instant" as ScrollBehavior }));
    await expect(cta).toHaveAttribute("data-state", "visible", { timeout: 2_000 });

    // Near the top → always visible.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
    await expect(cta).toHaveAttribute("data-state", "visible");
  });

  test("animation transform reflects the hidden state", async ({ page }) => {
    await gotoCta(page);
    await ensureScrollable(page);
    const cta = page.locator('[data-testid="bottom-cta"], [data-testid="bottom-cta-shell"]').first();

    await page.evaluate(() => window.scrollTo({ top: 800, behavior: "instant" as ScrollBehavior }));
    await expect(cta).toHaveAttribute("data-state", "hidden");

    const transform = await cta.evaluate((el) => getComputedStyle(el as HTMLElement).transform);
    // matrix() with non-zero translateY when hidden.
    expect(transform).not.toBe("none");
  });
});
