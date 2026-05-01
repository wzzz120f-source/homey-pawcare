import { test, expect } from "@playwright/test";

/**
 * Multi-viewport assertions for the BottomCta and booking modal:
 * - bottom position is consistent (>= 0, fully on-screen)
 * - padding-bottom respects safe-area minimum (≥12px)
 * - max-width never overflows viewport
 *
 * The actual viewport for each project is configured in playwright.config.ts.
 */

const TARGET_PATH = process.env.E2E_CTA_PATH ?? "/shop";

test.describe("BottomCta — layout consistency across viewports", () => {
  test("CTA stays inside viewport and has safe-area padding", async ({ page }, testInfo) => {
    await page.goto(TARGET_PATH);
    const cta = page
      .locator('[data-testid="bottom-cta"], [data-testid="bottom-cta-shell"]')
      .first();
    await cta.waitFor({ timeout: 10_000 });

    const box = await cta.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).not.toBeNull();

    // Within viewport horizontally and vertically.
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);

    // Padding-bottom ≥ 12px (max(0.75rem, env(safe-area-inset-bottom))).
    const pb = await cta.evaluate(
      (el) => parseFloat(getComputedStyle(el as HTMLElement).paddingBottom) || 0,
    );
    expect(pb).toBeGreaterThanOrEqual(12);

    // Inner card max-width caps at 32rem (512px); narrower viewports use full width minus padding.
    const innerCardWidth = await cta.evaluate((el) => {
      const inner = (el as HTMLElement).querySelector("div") as HTMLElement | null;
      return inner ? inner.getBoundingClientRect().width : 0;
    });
    expect(innerCardWidth).toBeLessThanOrEqual(viewport.width);

    await testInfo.attach(`cta-${testInfo.project.name}.png`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  });
});

test.describe("Booking modal — layout consistency across viewports", () => {
  test("hotel booking modal sticky footer fits viewport", async ({ page }, testInfo) => {
    // Navigate to first available pet hotel.
    await page.goto("/pet-hotel");
    const hotelCard = page.locator('a[href^="/pet-hotel/"]').first();
    if (!(await hotelCard.count())) test.skip(true, "No hotel listings available");
    await hotelCard.click();

    // Open booking modal via the bottom CTA's "立即预订".
    const cta = page.getByRole("button", { name: /立即预订/ }).first();
    await cta.waitFor({ timeout: 10_000 });
    await cta.click();

    const footer = page.locator('[data-testid="booking-modal-footer"]');
    await footer.waitFor();
    const fbox = await footer.boundingBox();
    const viewport = page.viewportSize()!;
    expect(fbox).not.toBeNull();

    // Footer fully visible.
    expect(fbox!.y + fbox!.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(fbox!.x).toBeGreaterThanOrEqual(0);
    expect(fbox!.x + fbox!.width).toBeLessThanOrEqual(viewport.width + 1);

    // Footer padding-bottom honors safe-area.
    const pb = await footer.evaluate(
      (el) => parseFloat(getComputedStyle(el as HTMLElement).paddingBottom) || 0,
    );
    expect(pb).toBeGreaterThanOrEqual(12);

    await testInfo.attach(`booking-modal-${testInfo.project.name}.png`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  });
});
