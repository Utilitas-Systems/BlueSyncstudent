#!/usr/bin/env bash
# Build BlueSync Student for macOS: DMG + signed updater + collect into release/.
# Run on a Mac only. Requires bluesync-signing.key in the project root.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "error: macOS release builds must run on a Mac (Darwin)." >&2
  exit 1
fi

if ! command -v xcode-select >/dev/null 2>&1 || ! xcode-select -p >/dev/null 2>&1; then
  echo "error: Xcode Command Line Tools required. Run: xcode-select --install" >&2
  exit 1
fi

if [[ ! -f "$ROOT/bluesync-signing.key" ]]; then
  echo "error: bluesync-signing.key not found. Copy from your Windows build machine." >&2
  exit 1
fi

echo "==> BlueSync Student macOS release build"
echo "    Root: $ROOT"
echo "    Arch: $(uname -m)"

# If Windows already built this version, keep its platforms when merging latest.json.
if [[ -f "$ROOT/release/updates/latest.json" ]]; then
  echo "==> Found existing release/updates/latest.json — collect will merge platforms."
fi

npm run release:build:mac

echo ""
echo "Done. Next steps:"
echo "  1. Test: open release/macos/BlueSync-Student.dmg"
echo "  2. Upload release/macos/* and release/updates/*.app.tar.gz to the releases bucket"
echo "  3. Publish release/updates/latest.json to bluesync.education"
echo "  Docs: MD/Student/Release/macOS/Deploy macOS Artifacts.md"
