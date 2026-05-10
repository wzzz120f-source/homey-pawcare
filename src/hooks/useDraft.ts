import { useEffect, useRef, useState, useCallback } from "react";

const VERSION = "v1";

interface DraftEnvelope<T> {
  v: string;
  t: number; // timestamp
  data: T;
}

interface Options {
  /** 'persistent' = localStorage（默认 30 天）；'session' = sessionStorage */
  scope?: "persistent" | "session";
  /** TTL 毫秒，默认 30 天，仅 persistent 生效 */
  ttlMs?: number;
}

const DEFAULT_TTL = 30 * 24 * 60 * 60 * 1000;

/**
 * 统一的草稿管理 hook：自动恢复 + 防抖保存 + 一键清除。
 * 返回 [draft, setDraft, clearDraft]。
 */
export function useDraft<T>(
  key: string,
  initial: T,
  options: Options = {},
): [T, (v: T | ((p: T) => T)) => void, () => void] {
  const { scope = "persistent", ttlMs = DEFAULT_TTL } = options;
  const storage = scope === "session" ? sessionStorage : localStorage;
  const fullKey = `draft:${VERSION}:${key}`;

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = storage.getItem(fullKey);
      if (!raw) return initial;
      const parsed = JSON.parse(raw) as DraftEnvelope<T>;
      if (scope === "persistent" && Date.now() - parsed.t > ttlMs) {
        storage.removeItem(fullKey);
        return initial;
      }
      return { ...initial as any, ...parsed.data };
    } catch {
      return initial;
    }
  });

  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      try {
        const env: DraftEnvelope<T> = { v: VERSION, t: Date.now(), data: value };
        storage.setItem(fullKey, JSON.stringify(env));
      } catch {
        // 存储满 / 隐私模式忽略
      }
    }, 400);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value, fullKey, storage]);

  const clear = useCallback(() => {
    storage.removeItem(fullKey);
    setValue(initial);
  }, [fullKey, initial, storage]);

  return [value, setValue, clear];
}
