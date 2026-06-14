#!/usr/bin/env bash
# Launch LingoLeaf on the iOS Simulator with settings suited for showcase video recording.
#
# Usage:
#   ./scripts/start-ios-recording.sh              # iPhone 15 Pro, light mode, 9:41 status bar
#   ./scripts/start-ios-recording.sh --reset-app  # fresh install (clears local onboarding/tutorial flags)
#   ./scripts/start-ios-recording.sh --skip-typecheck
#   SIMULATOR_NAME="iPhone 16 Pro" ./scripts/start-ios-recording.sh
#
# Record via Simulator → File → Record Screen, or QuickTime → New Screen Recording.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

SIMULATOR_NAME="${SIMULATOR_NAME:-iPhone 15 Pro}"
IOS_BUNDLE_ID="${IOS_BUNDLE_ID:-com.lingoleaf.app}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
RESET_APP=false
SKIP_TYPECHECK=false
CLEAN_BUILD=false

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  --reset-app       Uninstall the app from the booted simulator before launch (clean AsyncStorage)
  --skip-typecheck  Skip npm run type-check (faster restarts while iterating on takes)
  --clean           Clear Xcode DerivedData for LingoLeaf before building (like ./dev.sh ios clean)
  --simulator NAME  Override simulator (default: iPhone 15 Pro)
  -h, --help        Show this help

Environment:
  SIMULATOR_NAME    Same as --simulator
  ENV_FILE          Env file to verify exists (default: .env)

Requires a .env with EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_KEY, and
EXPO_PUBLIC_SUPABASE_DB_SCHEMA=lingoleaf (default) pointing at a project seeded with
demo data (see scripts/setup-demo-supabase.sh or docs/demo-seed-data.md).

Recording storyboard (18s): see projects/lingoleaf-web/public/showcase/README.md
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --reset-app) RESET_APP=true; shift ;;
    --skip-typecheck) SKIP_TYPECHECK=true; shift ;;
    --clean) CLEAN_BUILD=true; shift ;;
    --simulator)
      SIMULATOR_NAME="${2:?--simulator requires a device name}"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  echo "Copy .env.example → .env and add Supabase demo credentials." >&2
  exit 1
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "Xcode command-line tools not found. Install Xcode first." >&2
  exit 1
fi

if ! xcrun simctl list devices available 2>/dev/null | grep -F "$SIMULATOR_NAME" | grep -v "unavailable" | grep -q .; then
  echo "Simulator not found: $SIMULATOR_NAME" >&2
  echo "" >&2
  echo "Available iPhone simulators:" >&2
  xcrun simctl list devices available 2>/dev/null | grep -E "iPhone" | sed 's/^/  /' >&2 || true
  exit 1
fi

echo "🎬 LingoLeaf — iOS recording session"
echo "===================================="
echo "Simulator: $SIMULATOR_NAME"
echo ""

if [[ "$SKIP_TYPECHECK" != "true" ]]; then
  echo "🔍 Running type checks..."
  if ! npm run type-check; then
    echo "❌ Fix TypeScript errors or re-run with --skip-typecheck" >&2
    exit 1
  fi
  echo "✅ Type checks passed"
  echo ""
fi

echo "📱 Preparing simulator..."
export LANG=en_US.UTF-8

# Boot target simulator (no-op if already booted).
xcrun simctl boot "$SIMULATOR_NAME" 2>/dev/null || true
open -a Simulator

# Wait for Simulator.app to attach to the booted device.
for _ in $(seq 1 20); do
  if xcrun simctl list devices booted 2>/dev/null | grep -q "Booted"; then
    break
  fi
  sleep 0.5
done

# Presentation settings for marketing-style captures.
xcrun simctl ui booted appearance light 2>/dev/null || true
xcrun simctl status_bar booted override \
  --time "9:41" \
  --batteryState charged \
  --batteryLevel 100 \
  --cellularMode active \
  --cellularBars 4 \
  --wifiMode active \
  --wifiBars 3 2>/dev/null || true

if [[ "$RESET_APP" == "true" ]]; then
  echo "🧹 Removing existing app install ($IOS_BUNDLE_ID)..."
  xcrun simctl uninstall booted "$IOS_BUNDLE_ID" 2>/dev/null || true
fi

if [[ "$CLEAN_BUILD" == "true" ]]; then
  echo "🧹 Cleaning Xcode DerivedData for LingoLeaf..."
  rm -rf ~/Library/Developer/Xcode/DerivedData/LingoLeaf-*
  if [[ -d ios ]]; then
    (cd ios && pod install)
  fi
fi

cat <<'GUIDE'

📋 Recording checklist (18s recruiter cut)
----------------------------------------
  0:00–0:02  Home — garden + recent books visible
  0:02–0:07  Open Don Quijote → long-press "vendedores" → translation
  0:07–0:10  Save to "Spanish verbs" list
  0:10–0:14  Study tab → flashcard flip + rate once
  0:14–0:18  End card (App Store + stack pills)

Tips:
  • Simulator → File → Record Screen (or QuickTime screen recording)
  • Enable Do Not Disturb on macOS to hide notification banners
  • Use demo Supabase seed so Home shows library/history (setup-demo-supabase.sh)
  • Export to projects/lingoleaf-web/public/showcase/lingoleaf-recruiter.mp4

GUIDE

echo "🚀 Building and launching on $SIMULATOR_NAME..."
echo ""

exec npx expo run:ios --device "$SIMULATOR_NAME"
