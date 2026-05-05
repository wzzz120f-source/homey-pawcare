import { test, expect, Page } from "@playwright/test";

/**
 * 长列表页面的「最后一项可完整可见」回归测试。
 * 自动滚动到底，断言：
 *  - 列表里最后一个可见项的底边 ≤ 任意固定底栏（含全局 BottomNav）顶边
 *  - 即不被结算条 / 导航条压住
 *
 * 这些路由属于真实业务页面；如果路由不可达（未登录/无数据），用 test.skip 跳过。
 */

const ROUTES: { path: string; itemSelector: string; name: string }[] = [
  { path: "/shop", itemSelector: "[data-testid='product-card'], main a, main li", name: "商城" },
  { path: "/community", itemSelector: "main article, main [data-testid='post-card']", name: "社区" },
  { path: "/orders", itemSelector: "main article, main li, main [data-testid='order-card']", name: "订单历史" },
  { path: "/pet-hotel", itemSelector: "a[href^='/pet-hotel/']", name: "宠物酒店" },
];

async function lowestFixedTop(page: Page): Promise<number> {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(
      "[data-safe-area-bottom-bar], [data-bottom-nav], nav.fixed, .fixed.bottom-0",
    ));
    const vp = window.innerHeight;
    let top = vp;
    for (const n of nodes) {
      const r = n.getBoundingClientRect();
      // 仅统计真正贴底的固定元素
      if (r.bottom >= vp - 2 && r.height > 0) top = Math.min(top, r.top);
    }
    return top;
  });
}

async function scrollToBottomStable(page: Page) {
  // 多次尝试滚动到底，等待懒加载完成（高度稳定 2 帧）。
  let lastHeight = -1;
  for (let i = 0; i < 10; i++) {
    const h = await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      return document.documentElement.scrollHeight;
    });
    if (h === lastHeight) break;
    lastHeight = h;
    await page.waitForTimeout(250);
  }
}

for (const route of ROUTES) {
  test.describe(`long-list bottom visibility · ${route.name}`, () => {
    test(`最后一项不被底栏遮挡 (${route.path})`, async ({ page }) => {
      const resp = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      if (!resp || resp.status() >= 400) test.skip(true, `route ${route.path} not reachable`);

      // 等到至少一个候选项出现，否则跳过（页面无数据）
      const items = page.locator(route.itemSelector);
      try {
        await items.first().waitFor({ timeout: 5_000 });
      } catch {
        test.skip(true, `no list items found on ${route.path}`);
      }

      await scrollToBottomStable(page);

      const count = await items.count();
      expect(count).toBeGreaterThan(0);
      const last = items.nth(count - 1);
      await last.scrollIntoViewIfNeeded();

      const lastBox = await last.boundingBox();
      expect(lastBox).not.toBeNull();
      const fixedTop = await lowestFixedTop(page);
      // 容许 1px 抗锯齿误差
      expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(fixedTop + 1);
      // 且最后一项整体应在视口内
      expect(lastBox!.y).toBeGreaterThanOrEqual(0);
    });
  });
}
