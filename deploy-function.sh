#!/bin/bash

# Deploy Supabase Edge Function for Translation

set -e

echo "🚀 Deploying Translation Edge Function"
echo "======================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI not found"
  echo ""
  echo "Install via Homebrew:"
  echo "  brew install supabase/tap/supabase"
  echo ""
  echo "Or via npm (not recommended):"
  echo "  npx supabase"
  exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
  echo "❌ Error: .env file not found"
  exit 1
fi

# Load environment variables
source .env

# Check if required variables are set
if [ -z "$GOOGLE_TRANSLATE_API_KEY" ]; then
  echo "❌ Error: GOOGLE_TRANSLATE_API_KEY not set in .env"
  exit 1
fi

if [ -z "$EXPO_PUBLIC_SUPABASE_URL" ]; then
  echo "❌ Error: EXPO_PUBLIC_SUPABASE_URL not set in .env"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY not set in .env"
  exit 1
fi

echo "📦 Deploying function..."
supabase functions deploy translate --no-verify-jwt

echo ""
echo "🔑 Setting secrets..."
supabase secrets set \
  GOOGLE_TRANSLATE_API_KEY="$GOOGLE_TRANSLATE_API_KEY" \
  SUPABASE_URL="$EXPO_PUBLIC_SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"

echo ""
echo "✅ Translation function deployed successfully!"
echo ""
echo "Test it with:"
echo "  curl -X POST https://gowffgtxpqxabtskbqdo.supabase.co/functions/v1/translate \\"
echo "    -H 'Authorization: Bearer YOUR_ANON_KEY' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"source_lang\":\"es\",\"target_lang\":\"en\",\"text\":\"hola\"}'"

