/**
 * Tauri will not emit signed updater bundles (.nsis.zip / .sig, .app.tar.gz / .sig)
 * unless TAURI_SIGNING_PRIVATE_KEY is set (see https://v2.tauri.app/plugin/updater/).
 *
 * Usage:
 *   node scripts/check-updater-signing-env.mjs           # warn only, exit 0
 *   node scripts/check-updater-signing-env.mjs --require # exit 1 if missing
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifySigningKey } from "./minisign-key-probe.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const confPath = path.join(root, "src-tauri", "tauri.conf.json");
const conf = JSON.parse(fs.readFileSync(confPath, "utf8"));
const mode = conf?.bundle?.createUpdaterArtifacts;
const wantsUpdaterBundles = mode === true || mode === "v1Compatible";

if (!wantsUpdaterBundles) {
  console.log("bundle.createUpdaterArtifacts is off - no updater .zip/.sig bundles.");
  process.exit(0);
}

const { looksValid, preview, lineCount, hasSecretMarker, hasPublicMarker } = classifySigningKey(
  process.env.TAURI_SIGNING_PRIVATE_KEY,
);

console.log(
  `Signing key probe: length=${(process.env.TAURI_SIGNING_PRIVATE_KEY || "").trim().length} lineCount=${lineCount} secretMarker=${hasSecretMarker} publicMarker=${hasPublicMarker} preview=${JSON.stringify(preview)}`,
);

const requireFlag = process.argv.includes("--require");

if (looksValid) {
  console.log("TAURI_SIGNING_PRIVATE_KEY looks valid - Tauri should emit signed updater artifacts.");
  process.exit(0);
}

const product = conf?.productName || "app";
const ver = conf?.version || "?";

const msg = `
No valid TAURI_SIGNING_PRIVATE_KEY in the environment.

Without the minisign *private* key, Tauri cannot sign updates - you will get the NSIS .exe
installer but NOT the updater pair (*.nsis.zip + *.nsis.zip.sig).

Fix (PowerShell, from the nexus-class-sync-main folder):

  $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw .\\path\\to\\your.key
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "your-password-if-key-is-encrypted"

  npm run build
  npm run tauri build

Then look under (native Windows build):

  src-tauri\\target\\release\\bundle\\nsis\\

Files look like: "${product}_${ver}_x64_en-US.nsis.zip" and the same name with ".sig".
(Exact prefix matches productName + version from tauri.conf.json.)

Generate a key once (keep the .key file secret forever):

  npx @tauri-apps/cli signer generate -w .\\bluesync-signing.key

The .pub content must match plugins.updater.pubkey in src-tauri/tauri.conf.json.

GitHub Actions: set repository secrets TAURI_SIGNING_PRIVATE_KEY (full .key file) and,
if the key is encrypted, TAURI_SIGNING_PRIVATE_KEY_PASSWORD.

The secret must include BOTH lines of the .key file (starts with "untrusted comment:").
If GitHub stripped newlines, re-paste from Notepad or use a single-line base64 wrap of the whole file.
`;

console.error(msg.trim());

if (requireFlag) process.exit(1);
process.exit(0);
