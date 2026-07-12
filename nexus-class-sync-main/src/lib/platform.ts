/** Shared platform detection for Tauri desktop + Android (Chromebook) + web preview. */

export type AppPlatform = "windows" | "macos" | "android" | "linux" | "web";

export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !==
      "undefined"
  );
}

/**
 * Best-effort OS for the running shell. Android WebView UA includes "Android"
 * (including Chromebook Android apps). Desktop Tauri uses the host UA.
 */
export function getPlatform(): AppPlatform {
  if (!isTauri()) return "web";
  if (typeof navigator === "undefined") return "web";

  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || "").toLowerCase();

  if (ua.includes("android")) return "android";
  if (ua.includes("mac") || platform.includes("mac") || ua.includes("darwin")) return "macos";
  if (ua.includes("win") || platform.includes("win")) return "windows";
  if (ua.includes("linux") || platform.includes("linux")) return "linux";
  return "web";
}

/** True when native Bluetooth / system-audio invoke commands exist. */
export function hasNativeMonitoring(): boolean {
  return isTauri();
}

/**
 * Desktop Tauri updater (`latest.json` + minisign). Android/Chromebook updates
 * come from Managed Google Play — never run the desktop updater there.
 */
export function usesDesktopUpdater(): boolean {
  return isTauri() && getPlatform() !== "android";
}

export function isAndroid(): boolean {
  return getPlatform() === "android";
}
