/**
 * CI: read TAURI_SIGNING_PRIVATE_KEY, patch tauri.conf if invalid, write GITHUB_OUTPUT.
 * Run from nexus-class-sync-main with cwd set (GitHub Actions default).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifySigningKey } from "./minisign-key-probe.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const tauriConf = path.join(root, "src-tauri", "tauri.conf.json");

const rawIn = process.env.KEY ?? "";
const { raw, looksValid, preview, lineCount, hasSecretMarker, hasPublicMarker } =
  classifySigningKey(rawIn);

console.log(
  `::notice::Signing key probe: length=${raw.length} lineCount=${lineCount} secretMarker=${hasSecretMarker} publicMarker=${hasPublicMarker} preview=${JSON.stringify(preview)}`,
);

const j = JSON.parse(fs.readFileSync(tauriConf, "utf8"));
if (!looksValid) {
  if (raw.length > 0) {
    if (hasPublicMarker) {
      console.log(
        "::warning::TAURI_SIGNING_PRIVATE_KEY looks like a PUBLIC key. Use the .key file from `tauri signer generate`, not the .pub file.",
      );
    } else {
      console.log(
        "::warning::TAURI_SIGNING_PRIVATE_KEY is not recognized as a minisign secret key. Paste the FULL .key file (two lines: untrusted comment + base64). If it is one long line, ensure it still starts with untrusted comment: minisign encrypted secret key (or secret key).",
      );
    }
  } else {
    console.log("::notice::TAURI_SIGNING_PRIVATE_KEY not set - building without signed updater artifacts.");
  }
  j.bundle = j.bundle || {};
  j.bundle.createUpdaterArtifacts = false;
  fs.writeFileSync(tauriConf, JSON.stringify(j, null, 2) + "\n");
} else {
  console.log("Valid minisign private key detected; updater artifacts will be generated.");
}

const out = process.env.GITHUB_OUTPUT;
if (out) {
  fs.appendFileSync(out, `has_signing_key=${looksValid ? "true" : "false"}\n`);
}
