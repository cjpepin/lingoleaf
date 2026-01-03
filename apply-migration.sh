#!/bin/bash

# Apply database migration for language preferences

set -e

echo "🗄️  Applying Language Preferences Migration"
echo "=========================================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI not found"
  echo ""
  echo "Install via Homebrew:"
  echo "  brew install supabase/tap/supabase"
  exit 1
fi

echo "📦 Applying migration..."
supabase db push

echo ""
echo "✅ Migration applied successfully!"
echo ""
echo "New fields added to user_settings:"
echo "  - native_lang: User's native language"
echo "  - known_langs: Languages user can read"
echo "  - goal_langs: Languages user wants to learn"
