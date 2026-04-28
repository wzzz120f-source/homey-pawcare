import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalChunkRecovery, prefetchChunk } from "./lib/chunkRecovery";

// Global blank-screen recovery: reload once (capped) when a critical lazy
// chunk fails to load, e.g. due to stale dev-server hashes.
installGlobalChunkRecovery();

// Stale-asset detection on boot: prefetch the most-frequented critical chunks.
// If their resolved URLs are gone (HMR rebuilt with new hashes) the global
// recovery flow above will trigger a single reload.
if (typeof window !== "undefined") {
  const runPrefetch = () => {
    // Inner community components
    prefetchChunk("守护频道 GuardianChannel", () => import("./components/community/GuardianChannel"), { critical: true });
    prefetchChunk("寻宠雷达 PetRadar", () => import("./components/community/PetRadar"), { critical: true });
    // Critical community routes — keep this list aligned with App.tsx
    prefetchChunk("路由 CommunityPage", () => import("./pages/CommunityPage"), { critical: true });
    prefetchChunk("路由 PostDetailPage", () => import("./pages/PostDetailPage"), { critical: true });
    prefetchChunk("路由 CharityFootprintPage", () => import("./pages/CharityFootprintPage"), { critical: true });
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).requestIdleCallback?.(runPrefetch) ?? setTimeout(runPrefetch, 1500);
}

createRoot(document.getElementById("root")!).render(<App />);
