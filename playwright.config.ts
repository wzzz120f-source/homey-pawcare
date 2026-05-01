import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for BottomCta e2e tests.
 * Run: npx playwright install && npx playwright test
 * Targets: iPhone (iOS Safari) + Pixel (Android Chrome).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    trace: "on-first-retry",
  },
  projects: [
    { name: "ios-iphone-13", use: { ...devices["iPhone 13"] } },
    { name: "android-pixel-7", use: { ...devices["Pixel 7"] } },
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
