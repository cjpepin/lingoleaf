#!/usr/bin/env bash
# Expo web export loads AppEntry as a classic script. Some deps (zustand ESM) emit
# import.meta, which throws "Cannot use 'import.meta' outside a module".
set -euo pipefail

ROOT="${1:?usage: patch-web-demo-import-meta.sh <web-demo-root>}"
patched=0

while IFS= read -r -d '' file; do
  if grep -q 'import\.meta' "$file"; then
    perl -pi -e 's/\(import\.meta\.env\?import\.meta\.env\.MODE:void 0\)/"production"/g' "$file"
    echo "Patched import.meta in $file"
    patched=1
  fi
done < <(find "$ROOT" -path '*/_expo/static/js/web/AppEntry-*.js' -print0 2>/dev/null || true)

if [[ "$patched" -eq 0 ]]; then
  echo "No import.meta patches needed under $ROOT"
fi
