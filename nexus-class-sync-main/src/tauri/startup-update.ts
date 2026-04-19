import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "@/components/ui/sonner";
import { APP_DISPLAY_NAME, UPDATE_FAILED_WEBSITE_MESSAGE } from "@/lib/appVersion";

function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !==
      "undefined"
  );
}

const STARTUP_DELAY_MS = 4_000;
const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Runs after the root is rendered so Sonner is mounted.
 * Silent when not in Tauri, offline, or no compatible update.
 */
export function attachUpdaterLifecycle(): void {
  if (!isTauri()) return;

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
    let loadingId: string | number | undefined;
    try {
      loadingId = toast.loading(`Updating ${APP_DISPLAY_NAME} to v${pendingUpdate.version}`);
      await pendingUpdate.downloadAndInstall();
      if (loadingId !== undefined) toast.dismiss(loadingId);
      loadingId = undefined;
      try {
        toast.success(`Update installed (v${pendingUpdate.version}). Restarting`, { duration: 4000 });
        await relaunch();
      } catch {
        toast.success(`Update installed (v${pendingUpdate.version}). Restart the app to finish.`, {
          duration: 12_000,
        });
      }
    } catch (error) {
      console.error("Auto-update install failed:", error);
      if (loadingId !== undefined) toast.dismiss(loadingId);
      toast.error(UPDATE_FAILED_WEBSITE_MESSAGE, { duration: 10_000 });
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
