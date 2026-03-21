/**
 * Copies installers from src-tauri/target/release/bundle into release/windows and release/macos.
 * Run after `npm run tauri:build` on each platform (Windows produces .exe/.msi; macOS produces .dmg / .app).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const bundleRoot = path.join(root, "src-tauri", "target", "release", "bundle");

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

const destWin = path.join(root, "release", "windows");
const destMac = path.join(root, "release", "macos");
fs.mkdirSync(destWin, { recursive: true });
fs.mkdirSync(destMac, { recursive: true });

let copied = 0;
for (const f of walkFiles(bundleRoot)) {
  const base = path.basename(f);
  const lower = base.toLowerCase();
  if (lower.endsWith(".msi") || lower.endsWith(".exe")) {
    fs.copyFileSync(f, path.join(destWin, base));
    console.log("→ release/windows/", base);
    copied++;
  }
  if (lower.endsWith(".dmg")) {
    fs.copyFileSync(f, path.join(destMac, base));
    console.log("→ release/macos/", base);
    copied++;
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
    console.log("→ release/macos/", name, "/");
    copied++;
  }
}

if (copied === 0) {
  console.warn(
    "No bundle artifacts found under",
    bundleRoot,
    "— run npm run tauri:build first (on Windows for .exe/.msi, on macOS for .dmg/.app).",
  );
} else {
  console.log("Done. Copied", copied, "item(s).");
}
