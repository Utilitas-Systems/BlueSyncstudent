import { check, type Update } from "@tauri-apps/plugin-updater";
import { toast } from "@/components/ui/sonner";
import { formatUpdateError } from "@/lib/appVersion";
import { usesDesktopUpdater } from "@/lib/platform";
import { installUpdateWithOverlay } from "@/tauri/update-flow";

const STARTUP_DELAY_MS = 4_000;
const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Runs after the root is rendered so Sonner and the UpdateOverlay are mounted.
 * Silent when not in Tauri, on Android (Play Store updates), offline, or no
 * compatible update. When an update is found, the full-screen UpdateOverlay
 * takes over until the app relaunches.
 */
export function attachUpdaterLifecycle(): void {
  if (!usesDesktopUpdater()) return;

  let busy = false;

  const checkAndApplyUpdate = async () => {
    if (busy) return;

    let pendingUpdate: Update | null = null;
    try {
      pendingUpdate = await check();
    } catch {
      return;
    }

    if (!pendingUpdate) return;

    busy = true;
    try {
      const result = await installUpdateWithOverlay(pendingUpdate);
      if (result === "relaunch-failed") {
        toast.success(
          `Update installed (v${pendingUpdate.version}). Restart the app to finish.`,
          { duration: 12_000 },
        );
      }
    } catch (error) {
      console.error("Auto-update install failed:", error);
      toast.error("Update failed", {
        description: formatUpdateError(error),
        duration: 12_000,
      });
    } finally {
      try {
        await pendingUpdate.close();
      } catch {
        /* resource may already be dropped after install */
      }
      busy = false;
    }
  };

  window.setTimeout(() => {
    void checkAndApplyUpdate();
  }, STARTUP_DELAY_MS);

  window.setInterval(() => {
    void checkAndApplyUpdate();
  }, POLL_INTERVAL_MS);
}
