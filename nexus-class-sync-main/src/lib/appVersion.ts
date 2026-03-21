/**
 * Shown in window title bar, Login header, etc. Keep in sync with `productName` in `tauri.conf.json`.
 */
export const APP_DISPLAY_NAME = "BlueSync Student";

/**
 * Login footer label (marketing style).
 * `tauri.conf.json` → `version` must stay strict SemVer (no leading zeros in numeric parts, e.g. 1.0.4 not 1.00.04) or `tauri build` / updater tooling can fail.
 */
export const APP_VERSION = "1.00.05";
