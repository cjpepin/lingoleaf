#!/usr/bin/env bash
#
# Submit the latest iOS build (from build/ios/latest.txt) to App Store Connect via EAS.
# Run from repo root: ./scripts/ios-eas-submit.sh
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

LATEST_FILE="$ROOT_DIR/build/ios/latest.txt"

# Sanity checks
if ! command -v eas &>/dev/null; then
  echo "Error: EAS CLI not found. Install with: npm install -g eas-cli" >&2
  exit 1
fi
if [ ! -f "$LATEST_FILE" ]; then
  echo "Error: No latest build path found. Run a local build first: npm run ios:build:prod" >&2
  echo "Expected file: $LATEST_FILE" >&2
  exit 1
fi

IPA_PATH="$(cat "$LATEST_FILE")"
if [ -z "$IPA_PATH" ] || [ ! -f "$IPA_PATH" ]; then
  echo "Error: IPA path in latest.txt is missing or file not found: $IPA_PATH" >&2
  echo "Run a local build again: npm run ios:build:prod" >&2
  exit 1
fi

echo "[ios-eas-submit] Submitting IPA: $IPA_PATH"
echo "[ios-eas-submit] Profile: production"
echo ""

# Run without --non-interactive so EAS can prompt for ascAppId (App Store Connect app ID) if not set in eas.json
eas submit -p ios --profile production --path "$IPA_PATH"

echo ""
echo "[ios-eas-submit] Submit finished. Check App Store Connect for processing status."
