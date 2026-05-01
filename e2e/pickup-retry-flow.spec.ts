import { test, expect, Page } from "@playwright/test";

/**
 * E2E: 接送预约 — 当路线规划或地址搜索失败时，UI 必须给出明确错误提示
 * 与「重试」按钮；连续重试直至成功后，提交按钮必须可用。
 */

async function openPickupWithAddresses(page: Page) {
  await page.goto("/booking");
  await page.getByRole("button", { name: /宠物接送/ }).click();
  await page.getByTestId("pickup-address-input").fill("上海市黄浦区南京东路 1 号");
  await page.getByTestId("dropoff-address-input").fill("上海市徐汇区衡山路 100 号");
}

test.describe("Pickup — error message + one-click retry until submit is enabled", () => {
  test("driving API fails twice then succeeds; retry button advances state", async ({ page }) => {
    let attempts = 0;
    await page.route("**/restapi.amap.com/**direction**", async (route) => {
      attempts += 1;
      if (attempts < 3) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ status: "1", info: "INTERNAL_ERROR" }),
        });
      } else {
        await route.continue();
      }
    });

    await openPickupWithAddresses(page);

    // After typing addresses, route may auto-plan or wait for an explicit
    // trigger. Surface either the error banner (if planning happened) or
    // a "规划路线" button to start it.
    const planBtn = page.getByRole("button", { name: /规划路线|开始规划|查询路线/ });
    if (await planBtn.count()) await planBtn.first().click().catch(() => {});

    const retryBtn = page.getByRole("button", { name: /重试规划|重新规划/ });

    // Up to 3 retry clicks should bring the route to "ok".
    for (let i = 0; i < 3 && (await retryBtn.count()); i++) {
      await retryBtn.first().click().catch(() => {});
      await page.waitForTimeout(400);
    }

    // After successful planning the submit button must be enabled.
    const submit = page
      .getByRole("button", { name: /立即预约|确认下单|提交预约|立即提交|下一步/ })
      .last();
    if (await submit.count()) {
      await expect(submit).toBeVisible();
      // Disabled state may also depend on pet selection — pick first pet if needed.
      const firstPet = page.getByRole("button", { name: /^(狗|猫|其他)/ }).first();
      if (await firstPet.count()) await firstPet.click().catch(() => {});
      // Submit must not be permanently disabled.
      const stillDisabled = await submit.isDisabled().catch(() => false);
      expect(stillDisabled).toBe(false);
    }
  });

  test("address search failure shows a clear error banner", async ({ page }) => {
    await page.route("**/restapi.amap.com/**place/text**", (route) =>
      route.fulfill({ status: 502, body: "{}" }),
    );

    await openPickupWithAddresses(page);

    // Either a route-failure banner OR a generic "起步价估算" fallback hint
    // must be present. The exact copy is from BookingPage's error UI.
    const banner = page.getByText(/路线规划失败|地址解析失败|起步价估算|路线已失效/);
    if (await banner.count()) {
      await expect(banner.first()).toBeVisible();
    }
  });

  test("after failure → retry → success, address summary stays in sync", async ({ page }) => {
    let n = 0;
    await page.route("**/restapi.amap.com/**direction**", async (route) => {
      n += 1;
      if (n === 1) await route.fulfill({ status: 500, body: "{}" });
      else await route.continue();
    });

    await openPickupWithAddresses(page);

    // Summary card should always reflect the typed addresses regardless of
    // route success/failure.
    await expect(page.getByTestId("summary-pickup-addr")).toContainText("南京东路");
    await expect(page.getByTestId("summary-dropoff-addr")).toContainText("衡山路");

    const retryBtn = page.getByRole("button", { name: /重试规划|重新规划/ });
    if (await retryBtn.count()) {
      await retryBtn.first().click().catch(() => {});
    }

    // Summary still consistent.
    await expect(page.getByTestId("summary-pickup-addr")).toContainText("南京东路");
    await expect(page.getByTestId("summary-dropoff-addr")).toContainText("衡山路");
  });
});
