/**
 * Shown in window title bar, Login header, etc. Keep in sync with `productName` in `tauri.conf.json`.
 */
export const APP_DISPLAY_NAME = "BlueSync Student";

/** Shown only when an update was found but download/install failed. */
export const UPDATE_FAILED_WEBSITE_MESSAGE =
  "Update failed. You can install the latest build from the BlueSync website.";

/** Strict SemVer — must match `tauri.conf.json` → `version` (used by updater / APIs). */
export const APP_VERSION = "1.1.4";

/** Human-facing label in the UI (Login footer, etc.). */
export const APP_VERSION_LABEL = "V 1.1.4";
