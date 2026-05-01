import { test, expect } from "@playwright/test";

/**
 * E2E: 房型卡片可点击/键盘可选；选择后弹窗内显示的「房型」名称与
 * 「合计」金额会随选择而更新（标准房 → 豪华房 → VIP 套房）。
 */

const ROOM_NAMES = ["标准单宠房", "豪华双宠房", "VIP套房"];

async function openHotelDetail(page) {
  await page.goto("/pet-hotel");
  const hotelCard = page.locator('a[href^="/pet-hotel/"]').first();
  if (!(await hotelCard.count())) test.skip(true, "No hotel listings available");
  await hotelCard.click();
  // Default tab is rooms; ensure cards are present.
  await page.getByTestId("room-card-0").waitFor({ timeout: 10_000 });
}

async function openModalTotal(page): Promise<number> {
  const footer = page.locator('[data-testid="booking-modal-footer"]');
  await footer.waitFor();
  const text = (await footer.textContent()) ?? "";
  const m = text.match(/¥(\d+)/);
  return m ? Number(m[1]) : 0;
}

test.describe("Hotel room selection — clickable + keyboard accessible", () => {
  test("clicking a room card opens the modal pre-selected", async ({ page }) => {
    await openHotelDetail(page);
    await page.getByTestId("room-card-1").click();

    const selectedName = page.locator('[data-testid="modal-room-1"]');
    await selectedName.waitFor();
    await expect(selectedName).toHaveAttribute("aria-pressed", "true");
    await expect(selectedName).toContainText(ROOM_NAMES[1]);
  });

  test("keyboard Enter on a focused card selects it", async ({ page }) => {
    await openHotelDetail(page);
    const card = page.getByTestId("room-card-2");
    await card.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-testid="modal-room-2"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("changing room inside modal updates 房型 and 合计", async ({ page }) => {
    await openHotelDetail(page);
    await page.getByTestId("room-card-0").click();

    // Total at default room (idx=0).
    const total0 = await openModalTotal(page);
    expect(total0).toBeGreaterThan(0);

    // Switch to mid-tier.
    await page.getByTestId("modal-room-1").click();
    await expect(page.getByTestId("modal-room-1")).toHaveAttribute("aria-pressed", "true");
    const total1 = await openModalTotal(page);
    expect(total1).toBeGreaterThan(total0);

    // Switch to VIP.
    await page.getByTestId("modal-room-2").click();
    await expect(page.getByTestId("modal-room-2")).toHaveAttribute("aria-pressed", "true");
    const total2 = await openModalTotal(page);
    expect(total2).toBeGreaterThan(total1);

    // 房型 name reflected in the in-body cost breakdown.
    await expect(page.getByText(ROOM_NAMES[2])).toBeVisible();
  });

  test("nights stepper multiplies the chosen room price", async ({ page }) => {
    await openHotelDetail(page);
    await page.getByTestId("room-card-1").click();

    const oneNight = await openModalTotal(page);
    // Increment nights to 3.
    const plus = page.getByRole("button", { name: "+" }).first();
    await plus.click();
    await plus.click();

    const threeNights = await openModalTotal(page);
    expect(threeNights).toBe(oneNight * 3);
  });
});
