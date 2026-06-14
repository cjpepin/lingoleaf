#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="$ROOT_DIR/.env.demo"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy .env.demo.example first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

export EXPO_PUBLIC_DEMO_MODE=true
export EXPO_PUBLIC_WEB_BASE_PATH="${EXPO_PUBLIC_WEB_BASE_PATH:-/lingoleaf/demo}"
export EXPO_PUBLIC_SUPABASE_DB_SCHEMA="${EXPO_PUBLIC_SUPABASE_DB_SCHEMA:-lingoleaf}"

exec npx expo start --web
