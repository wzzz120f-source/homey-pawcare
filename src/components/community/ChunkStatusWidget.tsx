import { useEffect, useState } from "react";
import { Activity, CheckCircle2, AlertCircle, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { getChunkStatus, subscribeChunkStatus, getReloadAttempts, type ChunkStatus } from "@/lib/chunkRecovery";

/**
 * Compact widget shown in the community header that surfaces:
 * - current bundle hashes for tracked lazy chunks
 * - whether the last import retry succeeded
 * - global reload-attempt count (so users know recovery is bounded)
 */
const ChunkStatusWidget = () => {
  const [statusMap, setStatusMap] = useState<Record<string, ChunkStatus>>(getChunkStatus());
  const [open, setOpen] = useState(false);
  const reloads = getReloadAttempts();

  useEffect(() => subscribeChunkStatus(setStatusMap), []);

  const items = Object.values(statusMap);
  if (items.length === 0) return null;

  const hasError = items.some((i) => i.state === "error");
  const hasRetried = items.some((i) => i.state === "retried");
  const allOk = items.every((i) => i.state === "ok" || i.state === "retried");

  const Icon = hasError ? AlertCircle : hasRetried ? RotateCw : allOk ? CheckCircle2 : Activity;
  const tone = hasError
    ? "text-destructive border-destructive/40 bg-destructive/10"
    : hasRetried
      ? "text-status-warn-foreground border-status-warn-border bg-status-warn/60"
      : "text-muted-foreground border-border/60 bg-secondary/60";

  return (
    <div className="px-4 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn("flex w-full items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition-colors", tone)}
      >
        <Icon className={cn("h-3.5 w-3.5", hasRetried && !hasError && "animate-spin-slow")} />
        <span className="flex-1 text-left">
          模块状态 · {hasError ? "加载失败" : hasRetried ? "已自动重试成功" : allOk ? "全部正常" : "加载中"}
        </span>
        {reloads > 0 && <span className="rounded bg-background/70 px-1.5 py-0.5 font-mono text-[10px]">恢复 {reloads}/2</span>}
        <span className="text-[10px] opacity-70">{open ? "收起" : "详情"}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-1.5 rounded-xl border border-border/60 bg-background/80 p-3 text-[11px]">
          {items.map((s) => (
            <div key={s.module} className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{s.module}</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">hash: {s.hash || "—"}</p>
                {s.lastError && <p className="mt-0.5 truncate text-[10px] text-destructive">{s.lastError}</p>}
              </div>
              <span
                className={cn(
                  "flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
                  s.state === "ok" && "bg-status-ok/40 text-status-ok-foreground",
                  s.state === "retried" && "bg-status-warn/60 text-status-warn-foreground",
                  s.state === "error" && "bg-destructive/15 text-destructive",
                  s.state === "pending" && "bg-secondary text-muted-foreground",
                )}
              >
                {s.state === "ok" && "OK"}
                {s.state === "retried" && `重试×${s.attempts}`}
                {s.state === "error" && "失败"}
                {s.state === "pending" && "加载中"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChunkStatusWidget;
