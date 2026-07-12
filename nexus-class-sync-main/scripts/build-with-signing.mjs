/**
 * Runs `tauri build` with the updater signing key injected into the environment,
 * so the build emits signed updater artifacts (.nsis.zip/.app.tar.gz + .sig)
 * without any interactive password prompt.
 *
 * The key password is intentionally non-secret: it only protects the local key
 * file, which is gitignored. Real security comes from keeping the .key file off
 * the website/repo.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const keyPath = path.join(root, "bluesync-signing.key");

if (!fs.existsSync(keyPath)) {
  console.error(`Signing key not found: ${keyPath}`);
  process.exit(1);
}

const result = spawnSync("npm", ["run", "tauri:build", "--", ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    TAURI_SIGNING_PRIVATE_KEY: fs.readFileSync(keyPath, "utf8").trim(),
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "bluesync",
  },
});

process.exit(result.status ?? 1);
