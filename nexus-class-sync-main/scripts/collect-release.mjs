/**
 * Collect release artifacts from every `src-tauri/target/*/release/bundle` tree into:
 * - release/windows (installers + windows updater archives/signatures)
 * - release/macos   (installers + mac updater archives/signatures)
 * - release/updates (latest.json + all updater payloads/signatures for website upload)
 *
 * Cross-target builds (e.g. `tauri build --target aarch64-apple-darwin`) write under
 * `target/<triple>/release/bundle/`, not only `target/release/bundle/`.
 *
 * Windows: with `bundle.createUpdaterArtifacts: "v1Compatible"` you get `*.nsis.zip` + `*.nsis.zip.sig`
 * for static `latest.json` (Tauri v2 default `true` uses `*-setup.exe` + `*.exe.sig` instead).
 *
 * Run after `npm run tauri:build` on each platform. If you run it multiple times
 * (e.g. once on Windows + once on macOS), it keeps adding missing artifacts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function discoverBundleRoots() {
  const targetDir = path.join(root, "src-tauri", "target");
  const roots = new Set();
  const legacy = path.join(targetDir, "release", "bundle");
  if (fs.existsSync(legacy)) roots.add(legacy);
  if (fs.existsSync(targetDir)) {
    for (const name of fs.readdirSync(targetDir)) {
      const b = path.join(targetDir, name, "release", "bundle");
      if (fs.existsSync(b)) roots.add(b);
    }
  }
  return [...roots];
}

const destWin = path.join(root, "release", "windows");
const destMac = path.join(root, "release", "macos");
const destUpdates = path.join(root, "release", "updates");

for (const dir of [destWin, destMac, destUpdates]) {
  fs.mkdirSync(dir, { recursive: true });
}

function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

function copyFile(src, destDir, label) {
  const base = path.basename(src);
  const dest = path.join(destDir, base);
  fs.copyFileSync(src, dest);
  console.log(`→ ${label}${base}`);
  return 1;
}

function isWindowsInstaller(fileName) {
  return fileName.endsWith(".exe") || fileName.endsWith(".msi");
}

function isWindowsUpdaterArtifact(fileName) {
  return fileName.endsWith(".nsis.zip") || fileName.endsWith(".nsis.zip.sig");
}

function isMacInstaller(fileName) {
  return fileName.endsWith(".dmg");
}

function isMacUpdaterArtifact(fileName) {
  return fileName.endsWith(".app.tar.gz") || fileName.endsWith(".app.tar.gz.sig");
}

const bundleRoots = discoverBundleRoots();
if (bundleRoots.length === 0) {
  console.warn("No bundle directories found under src-tauri/target — run npm run tauri:build first.");
  process.exit(1);
}
console.log("Scanning bundle roots:", bundleRoots.join(" | "));

let copied = 0;
for (const bundleRoot of bundleRoots) {
  for (const filePath of walkFiles(bundleRoot)) {
    const base = path.basename(filePath);
    const lower = base.toLowerCase();

    if (isWindowsInstaller(lower)) {
      copied += copyFile(filePath, destWin, "release/windows/");
    }
    if (isMacInstaller(lower)) {
      copied += copyFile(filePath, destMac, "release/macos/");
    }
    if (isWindowsUpdaterArtifact(lower)) {
      copied += copyFile(filePath, destWin, "release/windows/");
      copied += copyFile(filePath, destUpdates, "release/updates/");
    }
    if (isMacUpdaterArtifact(lower)) {
      copied += copyFile(filePath, destMac, "release/macos/");
      copied += copyFile(filePath, destUpdates, "release/updates/");
    }
    if (lower === "latest.json") {
      copied += copyFile(filePath, destUpdates, "release/updates/");
    }
  }

  const macosDir = path.join(bundleRoot, "macos");
  if (fs.existsSync(macosDir)) {
    for (const name of fs.readdirSync(macosDir)) {
      if (!name.endsWith(".app")) continue;
      const src = path.join(macosDir, name);
      const dest = path.join(destMac, name);
      fs.rmSync(dest, { recursive: true, force: true });
      fs.cpSync(src, dest, { recursive: true });
      console.log("→ release/macos/", `${name}/`);
      copied++;
    }
  }
}

if (copied === 0) {
  console.warn("No release artifacts matched filters under bundle roots.");
  process.exit(1);
}

console.log("");
console.log("Done. Copied", copied, "item(s).");
console.log("Upload website updater files from: release/updates/");
console.log("Installers are in: release/windows/ and release/macos/");
