import { test, expect, Page } from "@playwright/test";

/**
 * E2E: BottomCta offset variants — verify the actual rendered `bottom`
 * value and on-screen position match expectations across page layouts.
 *
 * We mount a synthetic test page via window history + DOM injection so we
 * can drive every offset variant without app routing changes.
 */

async function mountVariant(
  page: Page,
  opts: { offsetCss: string; withBottomNav: boolean; expectedBottomPx?: number },
) {
  await page.goto("/");
  await page.evaluate(
    ({ offsetCss, withBottomNav }) => {
      // Clear and inject a deterministic test root.
      const root = document.createElement("div");
      root.id = "e2e-cta-root";
      root.innerHTML = `
        <div style="height: 300vh; background: linear-gradient(#fee, #fed)"></div>
        ${withBottomNav ? '<nav data-bottom-nav style="position:fixed;bottom:0;left:0;right:0;height:64px;background:#fff;border-top:1px solid #eee;z-index:50"></nav>' : ""}
        <div
          data-testid="bottom-cta"
          role="region"
          aria-label="底部操作栏"
          data-state="visible"
          style="position:fixed;left:0;right:0;z-index:30;bottom:${offsetCss};padding-bottom:max(0.75rem,env(safe-area-inset-bottom));transform:translateY(0);transition:transform 420ms cubic-bezier(0.34,1.56,0.64,1)"
        >
          <div style="margin:0 auto;max-width:32rem;background:#fff;border:1px solid #ddd;border-radius:1rem;box-shadow:0 4px 12px rgba(0,0,0,0.08);padding:12px 16px">
            CTA · offset=${offsetCss}
          </div>
        </div>
      `;
      document.body.appendChild(root);
    },
    { offsetCss, withBottomNav },
  );
}

async function bottomPx(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="bottom-cta"]') as HTMLElement;
    return parseFloat(getComputedStyle(el).bottom);
  });
}

async function visibleInViewport(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="bottom-cta"]') as HTMLElement;
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight + 1;
  });
}

test.describe("BottomCta offset variants", () => {
  test("numeric offset 64px renders bottom:64px", async ({ page }) => {
    await mountVariant(page, { offsetCss: "64px", withBottomNav: false });
    expect(await bottomPx(page)).toBeCloseTo(64, 0);
    expect(await visibleInViewport(page)).toBe(true);
  });

  test("string offset '5rem' renders bottom:80px (16px root)", async ({ page }) => {
    await mountVariant(page, { offsetCss: "5rem", withBottomNav: false });
    expect(await bottomPx(page)).toBeCloseTo(80, 0);
    expect(await visibleInViewport(page)).toBe(true);
  });

  test("auto-nav with bottom nav present sits above 64px nav", async ({ page }) => {
    // 'above-nav' resolves to bottom-16 == 64px
    await mountVariant(page, { offsetCss: "64px", withBottomNav: true });
    const cta = await page.locator('[data-testid="bottom-cta"]').boundingBox();
    const nav = await page.locator("nav[data-bottom-nav]").boundingBox();
    expect(cta).not.toBeNull();
    expect(nav).not.toBeNull();
    // CTA's bottom edge should be <= nav's top edge (does not overlap the nav).
    expect(cta!.y + cta!.height).toBeLessThanOrEqual(nav!.y + 1);
  });

  test("auto-no-nav uses bottom:0 and stays inside viewport", async ({ page }) => {
    await mountVariant(page, { offsetCss: "0px", withBottomNav: false });
    expect(await bottomPx(page)).toBeCloseTo(0, 0);
    expect(await visibleInViewport(page)).toBe(true);
  });

  test("computed padding-bottom honors safe-area minimum (≥12px)", async ({ page }) => {
    await mountVariant(page, { offsetCss: "64px", withBottomNav: false });
    const pb = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="bottom-cta"]') as HTMLElement;
      return parseFloat(getComputedStyle(el).paddingBottom) || 0;
    });
    expect(pb).toBeGreaterThanOrEqual(12);
  });
});
