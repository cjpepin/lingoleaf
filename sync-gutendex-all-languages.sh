#!/usr/bin/env bash
#
# Sync Gutendex catalog for 11 languages with learner-popularity–based book counts.
# Uses scripts/sync-gutendex.mjs (Gutendex returns ~32 books per page).
#
# Requires env: EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
# Writes to EXPO_PUBLIC_SUPABASE_DB_SCHEMA (default: lingoleaf).books
# Run from project root: ./sync-gutendex-all-languages.sh
# Optional:
#   ./sync-gutendex-all-languages.sh --dry-run
#   ./sync-gutendex-all-languages.sh --continue-on-error
#
# Gutendex (gutendex.com) is a free public API and can return 503 or time out under load.
# sync-gutendex.mjs retries automatically; re-run later or use --continue-on-error for partial syncs.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Project root: where scripts/sync-gutendex.mjs lives (works if this script is in repo root or in scripts/)
if [ -f "$SCRIPT_DIR/scripts/sync-gutendex.mjs" ]; then
  ROOT_DIR="$SCRIPT_DIR"
elif [ -f "$SCRIPT_DIR/sync-gutendex.mjs" ]; then
  ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
else
  ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export EXPO_PUBLIC_SUPABASE_DB_SCHEMA="${EXPO_PUBLIC_SUPABASE_DB_SCHEMA:-lingoleaf}"

DRY_RUN=""
CONTINUE_ON_ERROR=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="--dry-run" ;;
    --continue-on-error) CONTINUE_ON_ERROR=true ;;
  esac
done

if [ -n "$DRY_RUN" ]; then
  echo "Dry run: no writes to Supabase."
fi

echo "Target schema: ${EXPO_PUBLIC_SUPABASE_DB_SCHEMA}.books"

# ISO 639-1 language codes (Gutendex uses these). Format: code:pages (pages × 32 ≈ books).
# Counts tuned for language-learning popularity: en/fr/es largest; then de/zh/ja; then pt/ru/ko; ar/hi.
LANGS="en:16 fr:13 es:13 de:10 zh:10 ja:10 pt:8 ru:7 ko:7 ar:5 hi:5"
FAILED_LANGS=()

for entry in $LANGS; do
  lang="${entry%%:*}"
  pages="${entry##*:}"
  approx=$(( pages * 32 ))
  echo ""
  echo "=== $lang (~$approx books, $pages pages) ==="
  if node "./scripts/sync-gutendex.mjs" --lang "$lang" --pages "$pages" $DRY_RUN; then
    :
  elif [ "$CONTINUE_ON_ERROR" = true ]; then
    echo "Warning: $lang sync failed; continuing with remaining languages." >&2
    FAILED_LANGS+=("$lang")
  else
    exit 1
  fi
done

echo ""
if [ "${#FAILED_LANGS[@]}" -gt 0 ]; then
  echo "=== Sync finished with failures: ${FAILED_LANGS[*]} ===" >&2
  exit 1
fi
echo "=== All languages synced ==="
