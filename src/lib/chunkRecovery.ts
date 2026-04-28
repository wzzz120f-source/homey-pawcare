/**
 * Chunk recovery utilities
 * - Detects failed dynamic imports for critical lazy chunks
 * - Triggers a one-time reload to recover from stale dev-server hashes
 * - Avoids endless reload loops via sessionStorage cooldown
 * - Tracks per-module status for in-app diagnostics
 */
import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "lovable:chunk-reload-attempts";
const RELOAD_TS_KEY = "lovable:chunk-reload-last-ts";
const STATUS_KEY = "lovable:chunk-status";
const MAX_ATTEMPTS = 2;
const COOLDOWN_MS = 30_000; // don't reload more than once per 30s

export type ChunkStatus = {
  module: string;
  hash?: string;
  state: "pending" | "ok" | "error" | "retried";
  attempts: number;
  lastError?: string;
  updatedAt: string;
};

type StatusMap = Record<string, ChunkStatus>;
const listeners = new Set<(s: StatusMap) => void>();

const readStatus = (): StatusMap => {
  try {
    return JSON.parse(sessionStorage.getItem(STATUS_KEY) || "{}");
  } catch {
    return {};
  }
};
const writeStatus = (s: StatusMap) => {
  try {
    sessionStorage.setItem(STATUS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(s));
};

export const getChunkStatus = (): StatusMap => readStatus();

export const subscribeChunkStatus = (fn: (s: StatusMap) => void) => {
  listeners.add(fn);
  fn(readStatus());
  return () => listeners.delete(fn);
};

const updateStatus = (module: string, patch: Partial<ChunkStatus>) => {
  const all = readStatus();
  const prev = all[module] || { module, state: "pending", attempts: 0, updatedAt: new Date().toISOString() };
  all[module] = { ...prev, ...patch, module, updatedAt: new Date().toISOString() };
  writeStatus(all);
};

const extractHash = (factory: () => Promise<unknown>): string | undefined => {
  // Vite injects the resolved chunk URL into the toString of the lazy factory.
  const src = factory.toString();
  const match = src.match(/[?&]v=([\w-]+)/) || src.match(/-([A-Za-z0-9_-]{8,})\.js/);
  return match?.[1];
};

const isChunkLoadError = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message : String(err);
  return /dynamically imported module|Failed to fetch|Loading chunk|Importing a module script failed/i.test(msg);
};

const canReload = (): boolean => {
  try {
    const attempts = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
    const lastTs = Number(sessionStorage.getItem(RELOAD_TS_KEY) || "0");
    if (attempts >= MAX_ATTEMPTS) return false;
    if (Date.now() - lastTs < COOLDOWN_MS) return false;
    return true;
  } catch {
    return false;
  }
};

const recordReload = () => {
  try {
    const attempts = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
    sessionStorage.setItem(RELOAD_KEY, String(attempts + 1));
    sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
};

/** Reset reload counters after a successful import (proves recovery worked). */
const markRecovered = () => {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
    sessionStorage.removeItem(RELOAD_TS_KEY);
  } catch {
    /* ignore */
  }
};

/**
 * Wrap a dynamic import with status tracking + global recovery.
 * `critical=true` triggers an automatic one-time reload on failure (capped).
 */
export const lazyTracked = <T extends ComponentType<any>>(
  moduleName: string,
  factory: () => Promise<{ default: T }>,
  options: { critical?: boolean } = {},
) => {
  const hash = extractHash(factory);
  updateStatus(moduleName, { hash, state: "pending", attempts: 0 });

  return lazy(async () => {
    const prev = readStatus()[moduleName];
    const attempts = (prev?.attempts || 0) + 1;
    try {
      const mod = await factory();
      updateStatus(moduleName, { state: attempts > 1 ? "retried" : "ok", attempts, lastError: undefined, hash });
      markRecovered();
      return mod;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateStatus(moduleName, { state: "error", attempts, lastError: msg, hash });
      Object.assign(err as object, {
        communityModule: moduleName,
        chunkHash: hash,
        detectedAt: new Date().toISOString(),
      });

      if (options.critical && isChunkLoadError(err) && canReload()) {
        recordReload();
        // Defer slightly so the error surfaces in logs before reload.
        setTimeout(() => window.location.reload(), 80);
      }
      throw err;
    }
  });
};

/**
 * Prefetch a lazy chunk and verify it loads. Useful for stale-asset detection
 * on app boot — if the prefetch fails with a chunk-load error, trigger the
 * same capped reload flow.
 */
export const prefetchChunk = async (
  moduleName: string,
  factory: () => Promise<unknown>,
  options: { critical?: boolean } = {},
) => {
  const hash = extractHash(factory);
  updateStatus(moduleName, { hash, state: "pending" });
  try {
    await factory();
    updateStatus(moduleName, { state: "ok", hash });
    markRecovered();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    updateStatus(moduleName, { state: "error", lastError: msg, hash });
    if (options.critical && isChunkLoadError(err) && canReload()) {
      recordReload();
      setTimeout(() => window.location.reload(), 80);
    }
  }
};

/**
 * Install global listeners that recover from blank-screen scenarios caused by
 * failed chunk loads. Only reloads when the failure is a recognized
 * dynamic-import error AND the cooldown/cap allows it.
 */
export const installGlobalChunkRecovery = () => {
  if (typeof window === "undefined") return;
  if ((window as any).__lovableChunkRecoveryInstalled) return;
  (window as any).__lovableChunkRecoveryInstalled = true;

  const handle = (err: unknown) => {
    if (!isChunkLoadError(err)) return;
    if (!canReload()) return;
    recordReload();
    setTimeout(() => window.location.reload(), 80);
  };

  window.addEventListener("error", (e) => handle(e.error || e.message));
  window.addEventListener("unhandledrejection", (e) => handle(e.reason));
};

export const getReloadAttempts = (): number => {
  try {
    return Number(sessionStorage.getItem(RELOAD_KEY) || "0");
  } catch {
    return 0;
  }
};
