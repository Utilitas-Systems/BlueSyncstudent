/**
 * Rasterizes public/bluesync-student-logo.svg to 1024×1024 PNG, then runs `tauri icon` for all bundle formats.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const svgPath = path.join(root, "public", "bluesync-student-logo.svg");
const pngPath = path.join(root, "src-tauri", "icons", "icon-source-1024.png");

if (!fs.existsSync(svgPath)) {
  console.error("Missing:", svgPath);
  process.exit(1);
}

fs.mkdirSync(path.dirname(pngPath), { recursive: true });

await sharp(svgPath)
  .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(pngPath);

console.log("Wrote", pngPath);
const tauriCli = path.join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");
execSync(`"${process.execPath}" "${tauriCli}" icon "${pngPath}"`, {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
