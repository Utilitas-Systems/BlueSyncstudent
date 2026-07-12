import { useSyncExternalStore } from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdatePhase = "idle" | "downloading" | "installing" | "restarting";

export interface UpdateStatus {
  phase: UpdatePhase;
  version: string | null;
  /** Bytes downloaded so far. */
  received: number;
  /** Total download size in bytes, when the server reports it. */
  total: number | null;
}

const IDLE: UpdateStatus = { phase: "idle", version: null, received: 0, total: null };

let status: UpdateStatus = IDLE;
const listeners = new Set<() => void>();

function setStatus(next: UpdateStatus): void {
  status = next;
  for (const listener of listeners) listener();
}

/** Drives the full-screen UpdateOverlay; safe to use anywhere in the React tree. */
export function useUpdateStatus(): UpdateStatus {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => status,
  );
}

/**
 * Downloads and installs `update` while showing the full-screen updating
 * overlay, then relaunches the app.
 *
 * Resolves "relaunch-failed" when the update installed but the automatic
 * restart didn't work (caller should tell the user to restart manually).
 * Throws when download/install fails; the overlay is hidden first so the
 * caller's error toast is visible.
 */
export async function installUpdateWithOverlay(
  update: Update,
): Promise<"restarting" | "relaunch-failed"> {
  setStatus({ phase: "downloading", version: update.version, received: 0, total: null });
  try {
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          setStatus({
            phase: "downloading",
            version: update.version,
            received: 0,
            total: event.data.contentLength ?? null,
          });
          break;
        case "Progress":
          setStatus({ ...status, received: status.received + event.data.chunkLength });
          break;
        case "Finished":
          setStatus({ ...status, phase: "installing" });
          break;
      }
    });
  } catch (error) {
    setStatus(IDLE);
    throw error;
  }

  setStatus({ ...status, phase: "restarting" });
  try {
    await relaunch();
    return "restarting";
  } catch {
    setStatus(IDLE);
    return "relaunch-failed";
  }
}
