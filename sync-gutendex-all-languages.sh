#!/usr/bin/env bash
#
# Sync Gutendex catalog for 11 languages with learner-popularity–based book counts.
# Uses scripts/sync-gutendex.mjs (Gutendex returns ~32 books per page).
#
# Requires env: EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
# Run from project root: ./scripts/sync-gutendex-all-languages.sh
# Optional: ./scripts/sync-gutendex-all-languages.sh --dry-run
#

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

DRY_RUN=""
if [ "$1" = "--dry-run" ]; then
  DRY_RUN="--dry-run"
  echo "Dry run: no writes to Supabase."
fi

# ISO 639-1 language codes (Gutendex uses these). Format: code:pages (pages × 32 ≈ books).
# Counts tuned for language-learning popularity: en/fr/es largest; then de/zh/ja; then pt/ru/ko; ar/hi.
LANGS="en:16 fr:13 es:13 de:10 zh:10 ja:10 pt:8 ru:7 ko:7 ar:5 hi:5"

for entry in $LANGS; do
  lang="${entry%%:*}"
  pages="${entry##*:}"
  approx=$(( pages * 32 ))
  echo ""
  echo "=== $lang (~$approx books, $pages pages) ==="
  node "./scripts/sync-gutendex.mjs" --lang "$lang" --pages "$pages" $DRY_RUN
done

echo ""
echo "=== All languages synced ==="
