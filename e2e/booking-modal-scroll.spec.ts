import { test, expect } from "@playwright/test";

/**
 * E2E: 滚动 hotel booking modal 的可滚动 body 之后，sticky footer
 * 上的「确认提交 / 返回修改 / 取消 / 下一步：确认」按钮必须始终可见、
 * 不被 safe-area 裁切，并且可以接收点击。
 */

async function openHotelBookingModal(page) {
  await page.goto("/pet-hotel");
  const hotelCard = page.locator('a[href^="/pet-hotel/"]').first();
  if (!(await hotelCard.count())) test.skip(true, "No hotel listings available");
  await hotelCard.click();
  await page.getByRole("button", { name: /立即预订/ }).first().click();
  await page.locator('[data-testid="booking-modal-footer"]').waitFor();
}

test.describe("Booking modal — sticky footer remains clickable after scroll", () => {
  test("form-step 「下一步：确认」 stays visible after scrolling body", async ({ page }) => {
    await openHotelBookingModal(page);

    const footer = page.locator('[data-testid="booking-modal-footer"]');
    const nextBtn = page.getByTestId("btn-next-confirm");
    await expect(footer).toBeVisible();
    await expect(nextBtn).toBeVisible();

    // Scroll the modal body to the bottom (sibling of the footer).
    await page.evaluate(() => {
      const footer = document.querySelector('[data-testid="booking-modal-footer"]');
      const body = footer?.previousElementSibling as HTMLElement | null;
      if (body) body.scrollTop = body.scrollHeight;
    });

    // Footer must still be visible and within the viewport.
    const box = await footer.boundingBox();
    const vp = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);

    // Button must be hit-testable (not occluded).
    await expect(nextBtn).toBeVisible();
    await nextBtn.scrollIntoViewIfNeeded();
    // Click should succeed → moves to confirm step (or surfaces validation toast).
    await nextBtn.click();
  });

  test("confirm-step 「返回修改 / 确认提交」 stay visible after scroll", async ({ page }) => {
    await openHotelBookingModal(page);

    // Fill minimum required fields then advance to the confirm step.
    await page.getByRole("button", { name: /^狗|^猫|^其他/ }).first().click();
    await page.locator('input[type="date"]').fill(
      new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    );
    // First time slot.
    await page
      .locator('[data-testid="booking-modal-footer"]')
      .locator("..")
      .locator("button")
      .filter({ hasText: /^\d{2}:\d{2}/ })
      .first()
      .click()
      .catch(() => {});
    await page.getByTestId("btn-next-confirm").click();

    const submit = page.getByTestId("btn-submit-booking");
    const back = page.getByRole("button", { name: /返回修改/ });
    await expect(submit).toBeVisible();
    await expect(back).toBeVisible();

    // Scroll the modal body — the sticky footer must stay anchored.
    await page.evaluate(() => {
      const f = document.querySelector('[data-testid="booking-modal-footer"]');
      const body = f?.previousElementSibling as HTMLElement | null;
      if (body) body.scrollTop = body.scrollHeight;
    });

    const vp = page.viewportSize()!;
    const sBox = await submit.boundingBox();
    const bBox = await back.boundingBox();
    expect(sBox!.y + sBox!.height).toBeLessThanOrEqual(vp.height + 1);
    expect(bBox!.y + bBox!.height).toBeLessThanOrEqual(vp.height + 1);

    // Both buttons remain interactive.
    await expect(submit).toBeEnabled();
    await expect(back).toBeEnabled();
  });
});
