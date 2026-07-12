import { useUpdateStatus } from "@/tauri/update-flow";
import { APP_DISPLAY_NAME } from "@/lib/appVersion";

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Full-screen screen shown while an app update is downloading/installing.
 * Driven by the shared update store in `src/tauri/update-flow.ts`.
 */
export function UpdateOverlay() {
  const status = useUpdateStatus();
  if (status.phase === "idle") return null;

  const percent =
    status.phase === "downloading" && status.total
      ? Math.min(100, Math.round((status.received / status.total) * 100))
      : null;

  const headline =
    status.phase === "downloading"
      ? "Downloading update"
      : status.phase === "installing"
        ? "Installing update"
        : "Restarting";

  const detail =
    status.phase === "downloading"
      ? status.total
        ? `${formatMegabytes(status.received)} of ${formatMegabytes(status.total)}`
        : formatMegabytes(status.received)
      : status.phase === "installing"
        ? "This only takes a moment"
        : "See you in a second";

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-background"
      role="alertdialog"
      aria-live="assertive"
      aria-label={`Updating ${APP_DISPLAY_NAME}`}
    >
      <img
        src="/bluesync-student-logo.svg"
        alt=""
        className="w-20 h-20 object-contain animate-pulse"
      />

      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold text-nexus-secondary">
          Updating {APP_DISPLAY_NAME}
        </h1>
        {status.version ? (
          <p className="text-sm text-muted-foreground">
            {headline}
            {status.phase !== "restarting" ? ` to v${status.version}` : ""}�
          </p>
        ) : null}
      </div>

      <div className="w-full max-w-xs space-y-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          {percent !== null ? (
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          ) : (
            <div className="h-full w-full rounded-full bg-primary animate-pulse" />
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground tabular-nums">
          {percent !== null ? `${percent}% � ${detail}` : detail}
        </p>
      </div>

      <p className="text-xs text-muted-foreground/60">
        Please keep the app open � it will restart automatically.
      </p>
    </div>
  );
}
