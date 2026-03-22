/**
 * Shown in window title bar, Login header, etc. Keep in sync with `productName` in `tauri.conf.json`.
 */
export const APP_DISPLAY_NAME = "BlueSync Student";

/** Shown only when an update was found but download/install failed. */
export const UPDATE_FAILED_WEBSITE_MESSAGE =
  "Update failed. You can install the latest build from the BlueSync website.";

/**
 * Login footer label (marketing style).
 * `tauri.conf.json` → `version` must stay strict SemVer (e.g. 1.1.0); use this string for marketing labels like 1.01.00.
 */
export const APP_VERSION = "1.01.00";
