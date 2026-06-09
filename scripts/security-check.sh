#!/usr/bin/env bash
# Scan the working tree for common secret patterns before push.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

FAIL=0

scan() {
  local label="$1"
  local pattern="$2"
  local exclude="${3:-}"
  local args=(git grep -nE "$pattern" -- . ':!scripts/security-check.sh')
  if [[ -n "$exclude" ]]; then
    args+=("$exclude")
  fi
  if "${args[@]}" 2>/dev/null; then
    echo "FAIL: $label"
    FAIL=1
  fi
}

echo "Running security checks..."

scan "JWT literals" 'eyJhbGci[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+'
scan "OpenAI secret keys" 'sk-[A-Za-z0-9]{20,}'

if [[ -f .env ]]; then
  echo "WARN: .env exists locally (correctly gitignored). Do not commit it."
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo ""
  echo "Security check failed. Remove or redact matches before publishing."
  exit 1
fi

echo "Security check passed."
