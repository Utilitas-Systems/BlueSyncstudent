/**
 * After `npm run tauri:build`, lists everything under target/*/release/bundle
 * so you can confirm .nsis.zip / .sig / .app.tar.gz locations.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
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

if (roots.size === 0) {
  console.log("No bundle directory found. Run from nexus-class-sync-main after a Tauri build.");
  process.exit(0);
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

for (const br of [...roots].sort()) {
  console.log("\n---", br, "---");
  const files = walk(br).sort();
  if (files.length === 0) console.log("(empty)");
  else files.forEach((f) => console.log(f));
}

console.log("\nTip: .nsis.zip + .sig need TAURI_SIGNING_PRIVATE_KEY (+ password if encrypted) set during tauri build.");
console.log("See: https://v2.tauri.app/plugin/updater/");
