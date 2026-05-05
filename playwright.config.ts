import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for BottomCta + booking + safe-area e2e.
 * Multi-viewport coverage of iPhone (portrait + landscape) and a wide
 * range of Android notch / gesture-bar resolutions.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 1,
  expect: { timeout: 7_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    trace: "on-first-retry",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    // —— iPhone portrait ——
    { name: "iphone-se", use: { ...devices["iPhone SE"] } },
    { name: "iphone-12", use: { ...devices["iPhone 12"] } },
    { name: "iphone-13", use: { ...devices["iPhone 13"] } },
    { name: "iphone-13-mini", use: { ...devices["iPhone 13 Mini"] } },
    { name: "iphone-14", use: { ...devices["iPhone 14"] } },
    { name: "iphone-14-pro-max", use: { ...devices["iPhone 14 Pro Max"] } },
    { name: "iphone-15-pro", use: { ...devices["iPhone 15 Pro"] ?? devices["iPhone 14 Pro"] } },
    // —— iPhone landscape (homebar 在右侧/侧边的横屏小横条) ——
    { name: "iphone-12-landscape", use: { ...devices["iPhone 12 landscape"] } },
    { name: "iphone-13-landscape", use: { ...devices["iPhone 13 landscape"] } },
    { name: "iphone-14-pro-max-landscape", use: { ...devices["iPhone 14 Pro Max landscape"] } },
    // —— Android: 不同刘海/挖孔 + 手势区差异 ——
    { name: "pixel-5", use: { ...devices["Pixel 5"] } },
    { name: "pixel-7", use: { ...devices["Pixel 7"] } },
    { name: "galaxy-s9", use: { ...devices["Galaxy S9+"] } },
    { name: "galaxy-s8", use: { ...devices["Galaxy S8"] } },
    { name: "galaxy-tab-s4", use: { ...devices["Galaxy Tab S4"] } },
    { name: "nexus-10", use: { ...devices["Nexus 10"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:8080",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
