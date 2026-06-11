#!/usr/bin/env bash
# Apply LingoLeaf schema migrations and demo seed to a fresh Supabase project.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_REF="${1:-}"

if [[ -z "$PROJECT_REF" ]]; then
  echo "Usage: ./scripts/setup-demo-supabase.sh <project-ref>" >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required." >&2
  exit 1
fi

cd "$ROOT_DIR"
echo "Linking Supabase project: $PROJECT_REF"
supabase link --project-ref "$PROJECT_REF"

echo "Applying migrations..."
supabase db push

echo "Seeding demo catalog..."
supabase db query --linked --file supabase/demo/seed.sql

cat <<EOF

Demo Supabase setup complete.

Next steps:
1. Enable Auth -> Providers -> Anonymous sign-ins (required for guest demo).
2. Create a private Storage bucket named "general-library" if you upload EPUBs.
3. Deploy edge functions: ./deploy-function.sh
4. Set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY in .env.demo
5. Add the anon key to README demo section after rotation.

EOF
