import { defineConfig, devices } from "@playwright/test";
import { resolveDeviceMatrix } from "./e2e/device-matrix";

/**
 * Playwright config — 设备矩阵来自 e2e/device-matrix.ts。
 * 通过 E2E_DEVICE_PROFILE=smoke|core|full 或 E2E_DEVICES=<csv> 选择子集。
 * CI 默认 smoke，本地默认 full。
 */
const matrix = resolveDeviceMatrix();

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
  projects: matrix.map((entry) => {
    const dev =
      (devices as Record<string, unknown>)[entry.device] ??
      (entry.fallbackDevice ? (devices as Record<string, unknown>)[entry.fallbackDevice] : undefined);
    if (!dev) {
      throw new Error(
        `[playwright] Unknown device "${entry.device}" for project "${entry.name}". ` +
          `Update e2e/device-matrix.ts or set fallbackDevice.`,
      );
    }
    return { name: entry.name, use: { ...(dev as object) } };
  }),
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:8080",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
