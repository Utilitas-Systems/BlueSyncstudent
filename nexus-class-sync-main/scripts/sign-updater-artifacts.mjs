/**
 * Sign updater artifacts (.nsis.zip / .app.tar.gz) for the CURRENT version with
 * the local passwordless minisign key, producing the adjacent .sig files that
 * collect-release.mjs needs to build latest.json.
 *
 * Runs AFTER `tauri build` instead of using TAURI_SIGNING_PRIVATE_KEY during the
 * build, because on Windows the Tauri CLI hangs forever on an interactive
 * password prompt when TAURI_SIGNING_PRIVATE_KEY_PASSWORD is not set.
 *
 * The key password is intentionally non-secret: it only protects the local key
 * file, which is gitignored. Real security comes from keeping the .key file off
 * the website/repo.
 */
const KEY_PASSWORD = "bluesync";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const keyPath = path.join(root, "bluesync-signing.key");

if (!fs.existsSync(keyPath)) {
  console.error(`Signing key not found: ${keyPath}`);
  process.exit(1);
}

const version = JSON.parse(
  fs.readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8"),
).version;

function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

const targetDir = path.join(root, "src-tauri", "target");
const bundleRoots = [];
const legacy = path.join(targetDir, "release", "bundle");
if (fs.existsSync(legacy)) bundleRoots.push(legacy);
if (fs.existsSync(targetDir)) {
  for (const name of fs.readdirSync(targetDir)) {
    const b = path.join(targetDir, name, "release", "bundle");
    if (name !== "release" && fs.existsSync(b)) bundleRoots.push(b);
  }
}

const artifacts = bundleRoots
  .flatMap(walkFiles)
  .filter((p) => {
    const base = path.basename(p);
    const lower = base.toLowerCase();
    return (
      base.includes(version) &&
      (lower.endsWith(".nsis.zip") || lower.endsWith(".app.tar.gz"))
    );
  });

if (artifacts.length === 0) {
  console.error(`No v${version} updater artifacts found � run npm run tauri:build first.`);
  process.exit(1);
}

for (const file of artifacts) {
  console.log(`Signing ${path.basename(file)}`);
  execSync(`npx tauri signer sign --private-key-path "${keyPath}" --password "${KEY_PASSWORD}" "${file}"`, {
    cwd: root,
    stdio: "inherit",
  });
  if (!fs.existsSync(`${file}.sig`)) {
    console.error(`Expected signature was not created: ${file}.sig`);
    process.exit(1);
  }
}

console.log(`Signed ${artifacts.length} updater artifact(s) for v${version}.`);
