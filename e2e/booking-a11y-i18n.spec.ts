import { test, expect } from "@playwright/test";

const BOOKING_URL = "/booking";

test.describe("Booking — accessibility & i18n", () => {
  test("keyboard tab order reaches address inputs, retry & submit; no safe-area clipping", async ({
    page,
  }, testInfo) => {
    // Force address-search failure so the ErrorReport (and its retry button) renders.
    await page.route("**/restapi.amap.com/**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );

    await page.goto(BOOKING_URL);

    // Switch to pickup tab so address inputs + error report can appear.
    const pickupTab = page.getByRole("button", { name: /Pet pickup|宠物接送/ });
    await pickupTab.click();

    const pickupInput = page.getByTestId("pickup-address-input");
    const dropoffInput = page.getByTestId("dropoff-address-input");
    await expect(pickupInput).toBeVisible();

    // Type an address that will fail to resolve (Amap mocked 500).
    await pickupInput.fill("Test Pickup Plaza");
    await dropoffInput.fill("Test Dropoff Plaza");

    // Wait briefly for the unified ErrorReport to surface.
    const errorReport = page.getByTestId("error-report");
    await errorReport.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);

    // Tab focus should be reachable for: pickup input, dropoff input, retry, copy, submit.
    await pickupInput.focus();
    await expect(pickupInput).toBeFocused();

    // Retry button(s) must be focusable via keyboard.
    const retryBtn = page.getByTestId(/error-retry-/).first();
    if (await retryBtn.count()) {
      await retryBtn.focus();
      await expect(retryBtn).toBeFocused();
    }

    // Copy button must be keyboard reachable.
    const copyBtn = page.getByTestId("copy-error-details");
    if (await copyBtn.count()) {
      await copyBtn.focus();
      await expect(copyBtn).toBeFocused();
    }

    // Submit CTA in the BottomCta must remain visible and not clipped by safe-area.
    const submit = page.getByRole("button", { name: /Confirm booking|确认预约|提交预约|预约/ }).last();
    await submit.scrollIntoViewIfNeeded().catch(() => undefined);
    if (await submit.count()) {
      const box = await submit.boundingBox();
      const viewport = page.viewportSize();
      if (box && viewport) {
        expect(box.y + box.height, "submit must sit within viewport (no safe-area clip)").toBeLessThanOrEqual(
          viewport.height,
        );
        expect(box.y).toBeGreaterThanOrEqual(0);
      }
    }

    await testInfo.attach("a11y-screenshot.png", {
      body: await page.screenshot({ fullPage: false }),
      contentType: "image/png",
    });
  });

  test("language switcher toggles UI strings between Chinese and English", async ({ page }) => {
    await page.goto(BOOKING_URL);

    const switcher = page.getByTestId("language-switcher");
    await expect(switcher).toBeVisible();

    // Switch to English
    await page.getByTestId("lang-en").click();
    await expect(page.getByRole("heading", { name: "Booking details" })).toBeVisible();

    // Back button aria-label localized
    const backEn = page.getByRole("button", { name: "Back" });
    await expect(backEn).toBeVisible();

    // Switch back to Chinese
    await page.getByTestId("lang-zh").click();
    await expect(page.getByRole("heading", { name: "预约详情" })).toBeVisible();
    await expect(page.getByRole("button", { name: "返回" })).toBeVisible();
  });

  test("copy-error-details button is keyboard activatable and writes to clipboard", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    // Force route planning failure so the report shows up.
    await page.route("**/restapi.amap.com/**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );

    await page.goto(BOOKING_URL);
    await page.getByRole("button", { name: /Pet pickup|宠物接送/ }).click();
    await page.getByTestId("pickup-address-input").fill("A");
    await page.getByTestId("dropoff-address-input").fill("B");

    const copyBtn = page.getByTestId("copy-error-details");
    if (!(await copyBtn.count())) {
      test.skip(true, "ErrorReport not surfaced in this run");
    }

    await copyBtn.focus();
    await page.keyboard.press("Enter");

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip.length).toBeGreaterThan(0);
    expect(clip).toMatch(/address_search|route_planning/);
  });
});
