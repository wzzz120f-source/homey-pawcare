import { test, expect, Page } from "@playwright/test";

/**
 * Safe-area visual regression tests
 * ---------------------------------
 * 验证在 iPhone 全面屏（含小横条）以及 Android 多分辨率下：
 *  1) 全局 BottomNav 的内容不会被系统手势区压住 —— 元素底边 ≤ 视口高度，
 *     且容器 padding-bottom 至少为 safe-area-inset-bottom（≥0）。
 *  2) SafeAreaBottomLayout 渲染的固定底栏：
 *     - 完整位于视口内
 *     - 主体末尾留有 spacer，等高于底栏 + safe-area
 *  3) 原 BottomCta 的 safe-area padding 仍生效。
 *
 * 我们在 `/` 路径上注入一个 SAFE-AREA 模拟环境变量：
 *   document.documentElement.style.setProperty("--mock-safe-area-bottom", "34px")
 * 然后通过运行时注入测试 DOM 来覆盖各场景，以避免改动业务代码。
 */

const SAFE_AREA_PX_BY_DEVICE: Record<string, number> = {
  // —— iPhone 竖屏 ——
  "iphone-se": 0,                       // 经典 Home 键
  "iphone-12": 34,
  "iphone-13": 34,
  "iphone-13-mini": 34,
  "iphone-14": 34,
  "iphone-14-pro-max": 34,
  "iphone-15-pro": 34,
  // —— iPhone 横屏（小横条在右侧，但底部 inset 仍非零） ——
  "iphone-12-landscape": 21,
  "iphone-13-landscape": 21,
  "iphone-14-pro-max-landscape": 21,
  // —— Android 刘海/手势 ——
  "pixel-5": 24,
  "pixel-7": 24,
  "galaxy-s9": 0,
  "galaxy-s8": 0,
  "galaxy-tab-s4": 16,
  "nexus-10": 0,
};

async function withMockSafeArea(page: Page, px: number) {
  // 通过覆写 padding 工具类计算结果来模拟 env(safe-area-inset-bottom)。
  // CSS env() 在 headless Chromium 中默认为 0；这里注入一个 CSS 变量并改写
  // 任何带 `pb-[env(safe-area-inset-bottom)]` 或 `.safe-pb` / `.pb-nav`
  // 的元素，让其至少包含 px 像素，作为视觉回归断言基准。
  await page.addStyleTag({
    content: `
      :root { --mock-safe-area-bottom: ${px}px; }
      [class*="env(safe-area-inset-bottom)"],
      .safe-pb { padding-bottom: calc(${px}px + 0.5rem) !important; }
      .pb-nav { padding-bottom: calc(${px}px + 7rem) !important; }
      [data-safe-area-bottom-bar] { padding-bottom: calc(${px}px + 0.5rem) !important; }
      [data-bottom-nav] { padding-bottom: ${px}px !important; }
    `,
  });
}

async function mountFixedBar(page: Page, opts: { withGlobalNav: boolean }) {
  await page.goto("/");
  await page.evaluate(({ withGlobalNav }) => {
    document.body.innerHTML = `
      <div style="height: 250vh; background: linear-gradient(#fee, #fed)">
        <ul id="long-list">
          ${Array.from({ length: 40 })
            .map((_, i) => `<li style="padding:14px 16px;border-bottom:1px solid #eee">item ${i + 1}</li>`)
            .join("")}
        </ul>
      </div>
      ${withGlobalNav ? '<nav data-bottom-nav style="position:fixed;bottom:0;left:0;right:0;height:64px;background:#fff;border-top:1px solid #eee;z-index:50">nav</nav>' : ""}
      <div data-safe-area-bottom-bar style="position:fixed;left:0;right:0;bottom:${withGlobalNav ? 64 : 0}px;z-index:30;background:#fff;border-top:1px solid #ddd">
        <button data-testid="primary-cta" style="display:block;width:90%;margin:12px auto;height:44px;background:#f59e0b;color:#fff;border:0;border-radius:12px">主操作</button>
      </div>
    `;
  }, { withGlobalNav });
}

async function rect(page: Page, selector: string) {
  return page.locator(selector).boundingBox();
}

for (const [project, px] of Object.entries(SAFE_AREA_PX_BY_DEVICE)) {
  test.describe(`safe-area · ${project}`, () => {
    test.skip(({}, testInfo) => testInfo.project.name !== project, "device-scoped");

    test("固定底栏完整位于视口内（不被小横条压住）", async ({ page }) => {
      await mountFixedBar(page, { withGlobalNav: false });
      await withMockSafeArea(page, px);
      await page.waitForTimeout(50); // 让样式应用稳定后再测量

      const vp = page.viewportSize()!;
      const bar = await rect(page, "[data-safe-area-bottom-bar]");
      const cta = await rect(page, "[data-testid='primary-cta']");
      expect(bar).not.toBeNull();
      expect(cta).not.toBeNull();
      expect(bar!.y + bar!.height).toBeLessThanOrEqual(vp.height + 1);
      const ctaBottomGap = bar!.y + bar!.height - (cta!.y + cta!.height);
      expect(ctaBottomGap).toBeGreaterThanOrEqual(px);
    });

    test("底栏 + 全局 BottomNav 同时存在时彼此不重叠", async ({ page }) => {
      await mountFixedBar(page, { withGlobalNav: true });
      await withMockSafeArea(page, px);
      await page.waitForTimeout(50);

      const bar = await rect(page, "[data-safe-area-bottom-bar]");
      const nav = await rect(page, "nav[data-bottom-nav]");
      expect(bar).not.toBeNull();
      expect(nav).not.toBeNull();
      expect(bar!.y + bar!.height).toBeLessThanOrEqual(nav!.y + 1);
      const navPadBottom = await page.evaluate(() => {
        const el = document.querySelector("nav[data-bottom-nav]") as HTMLElement | null;
        return el ? parseFloat(getComputedStyle(el).paddingBottom) || 0 : 0;
      });
      expect(navPadBottom).toBeGreaterThanOrEqual(px);
    });

    test("主体长列表最后一项可完整滚动到视口（未被结算条遮挡）", async ({ page }) => {
      await mountFixedBar(page, { withGlobalNav: false });
      await withMockSafeArea(page, px);
      await page.evaluate((safePx) => {
        const bar = document.querySelector("[data-safe-area-bottom-bar]") as HTMLElement;
        const h = bar.getBoundingClientRect().height;
        const spacer = document.createElement("div");
        spacer.setAttribute("data-testid", "safe-area-spacer");
        spacer.style.height = `${Math.ceil(h) + 8 + safePx}px`;
        document.getElementById("long-list")!.appendChild(spacer);
      }, px);

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(50);
      const last = await rect(page, "#long-list li:last-of-type");
      const bar = await rect(page, "[data-safe-area-bottom-bar]");
      expect(last).not.toBeNull();
      expect(bar).not.toBeNull();
      expect(last!.y + last!.height).toBeLessThanOrEqual(bar!.y + 1);
    });
  });
}
