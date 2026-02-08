#!/usr/bin/env bash
#
# Run EAS local iOS production build and copy artifact to ./build/ios/ with latest.txt.
# Requires: Xcode, EAS CLI, Apple dev account, EAS credentials configured.
# Run from repo root: ./scripts/ios-eas-local-build.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/scripts/sync-gutendex.mjs" ]; then
  ROOT_DIR="$SCRIPT_DIR"
elif [ -f "$SCRIPT_DIR/sync-gutendex.mjs" ]; then
  ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
else
  ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
cd "$ROOT_DIR"

OUT_DIR="$ROOT_DIR/build/ios"
# Do not pass --output: the EAS local build plugin has a bug when copying artifacts to
# a custom path ("Cannot overwrite directory"). Let EAS write to its default location
# (current directory), then we find the .ipa and copy it to build/ios.

# Sanity checks
if ! command -v eas &>/dev/null; then
  echo "Error: EAS CLI not found. Install with: npm install -g eas-cli" >&2
  exit 1
fi
if ! command -v xcodebuild &>/dev/null; then
  echo "Error: Xcode CLI not found. Install Xcode from the App Store and run: xcode-select -s \$(xcode-select -p)" >&2
  exit 1
fi
if ! command -v fastlane &>/dev/null; then
  echo "Error: Fastlane not found. EAS local iOS builds require Fastlane." >&2
  echo "Install with: brew install fastlane" >&2
  echo "Or: sudo gem install fastlane" >&2
  exit 1
fi
if ! command -v pod &>/dev/null; then
  echo "Error: CocoaPods (pod) not found. EAS local iOS builds require CocoaPods." >&2
  echo "Install with: sudo gem install cocoapods" >&2
  echo "Or: brew install cocoapods" >&2
  exit 1
fi
if [ ! -f "app.json" ] && [ ! -f "app.config.ts" ] && [ ! -f "app.config.js" ]; then
  echo "Error: Run this script from the Expo project root (app.json or app.config.* not found)." >&2
  exit 1
fi

echo "[ios-eas-local-build] Starting EAS local iOS production build..."
echo "[ios-eas-local-build] IPA will be copied to: $OUT_DIR"
echo ""

eas build --local -p ios --profile production

# EAS writes the .ipa to the current directory when --output is omitted.
# Find the most recent .ipa, excluding build/ so we don't pick a previous copy.
IPA_PATH=""
IPA_PATH="$(find "$ROOT_DIR" -maxdepth 4 -name "*.ipa" -type f ! -path "$OUT_DIR/*" 2>/dev/null | xargs ls -t 2>/dev/null | head -1)"
if [ -z "$IPA_PATH" ] || [ ! -f "$IPA_PATH" ]; then
  echo "[ios-eas-local-build] Error: No .ipa found after build. Check EAS output for artifact path." >&2
  exit 1
fi

# Copy to build/ios and write latest.txt
mkdir -p "$OUT_DIR"
FINAL_IPA="$OUT_DIR/$(basename "$IPA_PATH")"
cp -f "$IPA_PATH" "$FINAL_IPA"
IPA_PATH="$(cd "$(dirname "$FINAL_IPA")" && pwd)/$(basename "$FINAL_IPA")"
echo "$IPA_PATH" > "$OUT_DIR/latest.txt"
echo ""
echo "[ios-eas-local-build] Build complete."
echo "[ios-eas-local-build] IPA path: $IPA_PATH"
echo "[ios-eas-local-build] Saved to: $OUT_DIR/latest.txt"
echo ""
echo "Submit with: npm run ios:submit:prod"
