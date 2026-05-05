/**
 * Safe-area / responsive 设备矩阵
 * --------------------------------
 * 把 Playwright 设备矩阵和对应的模拟 safe-area 像素抽成单一来源，
 * 让 `playwright.config.ts` 与 `e2e/safe-area.spec.ts` 共享。
 *
 * 通过环境变量切换子集，提升 CI 速度与稳定性：
 *   E2E_DEVICE_PROFILE=smoke   只跑 3 台主流机型（默认 CI）
 *   E2E_DEVICE_PROFILE=core    跑常用 7 台
 *   E2E_DEVICE_PROFILE=full    跑全部（含横屏 / 平板）
 *   E2E_DEVICES=iphone-13,pixel-7  逗号分隔自定义子集（优先级最高）
 *
 * 本地默认 `full`，CI 默认 `smoke`。
 */

export interface DeviceMatrixEntry {
  /** Playwright project / 测试 describe 名称 */
  name: string;
  /** Playwright `devices` 字典里的 key */
  device: string;
  /** 备用设备 key（当 Playwright 版本里没有首选 key 时使用） */
  fallbackDevice?: string;
  /** 模拟的 safe-area-inset-bottom（px） */
  safeAreaBottomPx: number;
  /** 所属类别，用于子集筛选 */
  category: "iphone-portrait" | "iphone-landscape" | "android" | "tablet";
  /** 子集标签 */
  tags: Array<"smoke" | "core" | "full">;
}

export const DEVICE_MATRIX: DeviceMatrixEntry[] = [
  // —— iPhone 竖屏 ——
  { name: "iphone-se", device: "iPhone SE", safeAreaBottomPx: 0, category: "iphone-portrait", tags: ["core", "full"] },
  { name: "iphone-12", device: "iPhone 12", safeAreaBottomPx: 34, category: "iphone-portrait", tags: ["smoke", "core", "full"] },
  { name: "iphone-13", device: "iPhone 13", safeAreaBottomPx: 34, category: "iphone-portrait", tags: ["core", "full"] },
  { name: "iphone-13-mini", device: "iPhone 13 Mini", safeAreaBottomPx: 34, category: "iphone-portrait", tags: ["full"] },
  { name: "iphone-14", device: "iPhone 14", safeAreaBottomPx: 34, category: "iphone-portrait", tags: ["full"] },
  { name: "iphone-14-pro-max", device: "iPhone 14 Pro Max", safeAreaBottomPx: 34, category: "iphone-portrait", tags: ["core", "full"] },
  { name: "iphone-15-pro", device: "iPhone 15 Pro", fallbackDevice: "iPhone 14 Pro", safeAreaBottomPx: 34, category: "iphone-portrait", tags: ["full"] },
  // —— iPhone 横屏 ——
  { name: "iphone-12-landscape", device: "iPhone 12 landscape", safeAreaBottomPx: 21, category: "iphone-landscape", tags: ["full"] },
  { name: "iphone-13-landscape", device: "iPhone 13 landscape", safeAreaBottomPx: 21, category: "iphone-landscape", tags: ["full"] },
  { name: "iphone-14-pro-max-landscape", device: "iPhone 14 Pro Max landscape", safeAreaBottomPx: 21, category: "iphone-landscape", tags: ["full"] },
  // —— Android ——
  { name: "pixel-5", device: "Pixel 5", safeAreaBottomPx: 24, category: "android", tags: ["core", "full"] },
  { name: "pixel-7", device: "Pixel 7", safeAreaBottomPx: 24, category: "android", tags: ["smoke", "core", "full"] },
  { name: "galaxy-s9", device: "Galaxy S9+", safeAreaBottomPx: 0, category: "android", tags: ["core", "full"] },
  { name: "galaxy-s8", device: "Galaxy S8", safeAreaBottomPx: 0, category: "android", tags: ["full"] },
  // —— 平板 ——
  { name: "galaxy-tab-s4", device: "Galaxy Tab S4", safeAreaBottomPx: 16, category: "tablet", tags: ["full"] },
  { name: "nexus-10", device: "Nexus 10", safeAreaBottomPx: 0, category: "tablet", tags: ["full"] },
];

export type DeviceProfile = "smoke" | "core" | "full";

function defaultProfile(): DeviceProfile {
  if (process.env.E2E_DEVICE_PROFILE) {
    const p = process.env.E2E_DEVICE_PROFILE.toLowerCase();
    if (p === "smoke" || p === "core" || p === "full") return p;
  }
  return process.env.CI ? "smoke" : "full";
}

/**
 * 根据环境变量解析当前要跑的设备列表。
 * - `E2E_DEVICES` 显式列名最优先
 * - 否则按 `E2E_DEVICE_PROFILE` 标签过滤
 */
export function resolveDeviceMatrix(): DeviceMatrixEntry[] {
  const explicit = process.env.E2E_DEVICES?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (explicit && explicit.length) {
    const set = new Set(explicit);
    return DEVICE_MATRIX.filter((d) => set.has(d.name));
  }
  const profile = defaultProfile();
  return DEVICE_MATRIX.filter((d) => d.tags.includes(profile));
}

export const SAFE_AREA_PX_BY_DEVICE: Record<string, number> = Object.fromEntries(
  DEVICE_MATRIX.map((d) => [d.name, d.safeAreaBottomPx]),
);
