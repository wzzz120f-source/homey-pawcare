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
  requestIdleCallback?.(() => {
    prefetchChunk("守护频道 GuardianChannel", () => import("./components/community/GuardianChannel"), { critical: true });
    prefetchChunk("寻宠雷达 PetRadar", () => import("./components/community/PetRadar"), { critical: true });
  }) ?? setTimeout(() => {
    prefetchChunk("守护频道 GuardianChannel", () => import("./components/community/GuardianChannel"), { critical: true });
    prefetchChunk("寻宠雷达 PetRadar", () => import("./components/community/PetRadar"), { critical: true });
  }, 1500);
}

createRoot(document.getElementById("root")!).render(<App />);
