#!/bin/bash
# Quick verification script - Run this first to check current status

echo "🔍 Edge Functions Migration - Quick Status Check"
echo "=================================================="
echo ""

# Check CLI
if command -v supabase >/dev/null 2>&1; then
    echo "✅ Supabase CLI: $(supabase --version)"
else
    echo "❌ Supabase CLI: Not installed"
    echo "   Install: curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz && sudo mv supabase /usr/local/bin/"
fi

# Check login
if supabase projects list >/dev/null 2>&1; then
    echo "✅ Supabase Login: Authenticated"
else
    echo "❌ Supabase Login: Not authenticated"
    echo "   Login: supabase login"
fi

# Check local functions
if [ -d "supabase/functions" ]; then
    FUNC_COUNT=$(find supabase/functions -mindepth 1 -maxdepth 1 -type d ! -name '_*' | wc -l)
    echo "✅ Local Functions: $FUNC_COUNT found"
else
    echo "❌ Local Functions: Directory not found"
fi

# Check config
if [ -f "supabase/config.toml" ]; then
    if grep -q "domipubyjkhsrmdwtabh" supabase/config.toml; then
        echo "✅ Project Config: Configured for domipubyjkhsrmdwtabh"
    else
        echo "⚠️  Project Config: Different project ID"
    fi
else
    echo "❌ Project Config: config.toml not found"
fi

# Check scripts
SCRIPT_COUNT=0
[ -f "scripts/migrate-edge-functions.sh" ] && ((SCRIPT_COUNT++))
[ -f "scripts/deploy-all-functions.sh" ] && ((SCRIPT_COUNT++))
[ -f "scripts/setup-functions-secrets.sh" ] && ((SCRIPT_COUNT++))
[ -f "scripts/verify-functions-migration.sh" ] && ((SCRIPT_COUNT++))

if [ $SCRIPT_COUNT -eq 4 ]; then
    echo "✅ Migration Scripts: All 4 scripts ready"
else
    echo "⚠️  Migration Scripts: $SCRIPT_COUNT of 4 found"
fi

echo ""
echo "=================================================="
echo ""
echo "📚 Next Steps:"
echo ""
echo "1. Review documentation:"
echo "   cat EDGE_FUNCTIONS_MIGRATION_INDEX.md"
echo ""
echo "2. Run full migration:"
echo "   chmod +x scripts/migrate-edge-functions.sh"
echo "   ./scripts/migrate-edge-functions.sh"
echo ""
echo "3. Or run step-by-step:"
echo "   ./scripts/setup-functions-secrets.sh"
echo "   ./scripts/deploy-all-functions.sh"
echo "   ./scripts/verify-functions-migration.sh"
echo ""
