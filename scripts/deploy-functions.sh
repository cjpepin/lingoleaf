#!/bin/bash
#
# Deploy Supabase Edge Functions
#
# Usage:
#   ./deploy-functions.sh                 # deploy all functions under supabase/functions
#   ./deploy-functions.sh translate       # deploy only 'translate'
#   ./deploy-functions.sh foo bar         # deploy multiple
#
# Notes:
# - Requires Supabase CLI (`supabase`)
# - Uses `.env` (optional) for setting secrets for known functions (translate)
#

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FUNCTIONS_DIR="$ROOT_DIR/supabase/functions"

echo "🚀 Deploying Supabase Edge Functions"
echo "==================================="
echo ""

if ! command -v supabase >/dev/null 2>&1; then
  echo "❌ Supabase CLI not found"
  echo ""
  echo "Install via Homebrew:"
  echo "  brew install supabase/tap/supabase"
  echo ""
  echo "Or via npm:"
  echo "  npm install -g supabase"
  exit 1
fi

if [ ! -d "$FUNCTIONS_DIR" ]; then
  echo "❌ Functions directory not found: $FUNCTIONS_DIR"
  exit 1
fi

# Load .env if present (optional)
if [ -f "$ROOT_DIR/.env" ]; then
  # shellcheck disable=SC1090
  source "$ROOT_DIR/.env"
fi

deploy_one() {
  local name="$1"

  if [ ! -d "$FUNCTIONS_DIR/$name" ]; then
    echo "❌ Function not found: $name (expected $FUNCTIONS_DIR/$name)"
    exit 1
  fi

  echo "📦 Deploying function: $name"
  supabase functions deploy "$name" --no-verify-jwt

  # Known function secrets
  if [ "$name" = "translate" ]; then
    if [ -n "${GOOGLE_TRANSLATE_API_KEY:-}" ] && [ -n "${EXPO_PUBLIC_SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
      echo "🔑 Setting secrets for translate..."
      supabase secrets set \
        GOOGLE_TRANSLATE_API_KEY="$GOOGLE_TRANSLATE_API_KEY" \
        SUPABASE_URL="$EXPO_PUBLIC_SUPABASE_URL" \
        SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
    else
      echo "⚠️  Skipping secrets for translate (missing one of GOOGLE_TRANSLATE_API_KEY / EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env)"
    fi
  fi

  echo "✅ Deployed: $name"
  echo ""
}

if [ "$#" -gt 0 ]; then
  for fn in "$@"; do
    deploy_one "$fn"
  done
  echo "🎉 Done."
  exit 0
fi

echo "🔎 No function names provided; deploying all functions in $FUNCTIONS_DIR"
echo ""

shopt -s nullglob
found_any=false
for dir in "$FUNCTIONS_DIR"/*; do
  name="$(basename "$dir")"
  # Skip non-directories and internal dirs
  if [ ! -d "$dir" ]; then
    continue
  fi
  if [ "$name" = "_shared" ]; then
    continue
  fi
  # Only deploy dirs that look like functions
  if [ ! -f "$dir/index.ts" ] && [ ! -f "$dir/index.js" ]; then
    continue
  fi
  found_any=true
  deploy_one "$name"
done

if [ "$found_any" = false ]; then
  echo "⚠️  No functions found under $FUNCTIONS_DIR"
  exit 0
fi

echo "🎉 Done."


