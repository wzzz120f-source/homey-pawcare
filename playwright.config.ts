import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for BottomCta + booking e2e.
 * Multi-viewport coverage of common iPhone/Android sizes.
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
    { name: "iphone-se", use: { ...devices["iPhone SE"] } },
    { name: "iphone-12", use: { ...devices["iPhone 12"] } },
    { name: "iphone-13", use: { ...devices["iPhone 13"] } },
    { name: "iphone-14-pro-max", use: { ...devices["iPhone 14 Pro Max"] } },
    { name: "pixel-5", use: { ...devices["Pixel 5"] } },
    { name: "pixel-7", use: { ...devices["Pixel 7"] } },
    { name: "galaxy-s9", use: { ...devices["Galaxy S9+"] } },
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
