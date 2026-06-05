#!/bin/bash
# ============================================
# Clear Lint Cache & Re-validate Schema
# ============================================
# Purpose: Clear cached metadata that may contain stale table references
# Context: Resolving false positive for message_template_assignments

set -e

echo "🧹 Clearing Supabase CLI cache..."
if [ -d "$HOME/.supabase" ]; then
  rm -rf "$HOME/.supabase"
  echo "✅ Cleared ~/.supabase/"
else
  echo "ℹ️  No Supabase cache found"
fi

echo ""
echo "🧹 Clearing npm cache..."
npm cache clean --force 2>/dev/null || echo "ℹ️  npm cache already clean"

echo ""
echo "🧹 Clearing any local .temp files..."
if [ -d "supabase/.temp" ]; then
  rm -rf supabase/.temp/*
  echo "✅ Cleared supabase/.temp/"
fi

echo ""
echo "📋 Verifying Supabase project connection..."
if command -v supabase &> /dev/null; then
  supabase status 2>/dev/null || echo "ℹ️  Not linked to local project"
  echo ""
  echo "🔍 Checking for message_template_assignments..."
  echo "Running: supabase db lint --linked"
  supabase db lint --linked 2>/dev/null || echo "⚠️  Cannot run lint (not linked or no CLI)"
else
  echo "⚠️  Supabase CLI not installed"
fi

echo ""
echo "✅ Cache clearing complete!"
echo ""
echo "Next steps:"
echo "1. Run: psql \"\$DATABASE_URL\" -f scripts/verify-message-templates-table.sql"
echo "2. Verify output shows only 'message_templates' (not 'message_template_assignments')"
echo "3. If lint still reports the issue, check CI/CD pipeline cache"
echo ""
echo "Documentation: MESSAGE_TEMPLATE_ASSIGNMENTS_FALSE_POSITIVE.md"
