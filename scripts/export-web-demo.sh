#!/usr/bin/env bash
# Build static web demo assets for hosting at /lingoleaf/demo on your portfolio site.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${1:-$ROOT_DIR/.env.demo}"
OUTPUT_DIR="${2:-$ROOT_DIR/dist/web-demo}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  echo "Copy .env.demo.example -> .env.demo and fill demo Supabase values." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

export EXPO_PUBLIC_DEMO_MODE=true
export EXPO_PUBLIC_WEB_BASE_PATH="${EXPO_PUBLIC_WEB_BASE_PATH:-/lingoleaf/demo}"
export EXPO_PUBLIC_SUPABASE_DB_SCHEMA="${EXPO_PUBLIC_SUPABASE_DB_SCHEMA:-lingoleaf}"

echo "Building web demo with base path: $EXPO_PUBLIC_WEB_BASE_PATH"
npx expo export --platform web --output-dir "$OUTPUT_DIR"

PATCH_SCRIPT="$ROOT_DIR/scripts/patch-web-demo-import-meta.sh"
if [[ -f "$PATCH_SCRIPT" ]]; then
  bash "$PATCH_SCRIPT" "$OUTPUT_DIR"
fi

cat <<EOF

Web demo build complete: $OUTPUT_DIR

Deploy the contents of that folder to your site at:
  https://YOUR_DOMAIN${EXPO_PUBLIC_WEB_BASE_PATH}/

For SPA routing, configure your host to fallback to index.html under that path.

Example nginx snippet:
  location ${EXPO_PUBLIC_WEB_BASE_PATH}/ {
    alias /var/www/lingoleaf-demo/;
    try_files \$uri \$uri/ ${EXPO_PUBLIC_WEB_BASE_PATH%/}/index.html;
  }

EOF
