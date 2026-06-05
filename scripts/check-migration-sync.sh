#!/bin/bash
# Script to check which migrations are in remote but missing locally

set -euo pipefail

echo "Checking migration sync between remote database and local files..."
echo ""

# Get remote migrations from database
echo "Fetching remote migration versions..."
REMOTE_MIGRATIONS=$(psql "$SUPABASE_DB_URL" -t -c "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;" 2>&1)

if [ $? -ne 0 ]; then
    echo "❌ Failed to query remote database. Make sure SUPABASE_DB_URL is set."
    exit 1
fi

echo "Remote migrations found:"
echo "$REMOTE_MIGRATIONS" | grep -v '^$' || echo "  (none)"
echo ""

# Get local migration versions
echo "Local migration files:"
LOCAL_VERSIONS=$(ls supabase/migrations/*.sql 2>/dev/null | xargs -n1 basename | cut -d'_' -f1 | sort)
echo "$LOCAL_VERSIONS"
echo ""

# Find migrations in remote but not local
echo "Checking for missing local files..."
MISSING=0
while IFS= read -r remote_version; do
    # Trim whitespace
    remote_version=$(echo "$remote_version" | xargs)
    
    if [ -z "$remote_version" ]; then
        continue
    fi
    
    if ! echo "$LOCAL_VERSIONS" | grep -q "^$remote_version$"; then
        echo "❌ Missing local file for remote migration: $remote_version"
        MISSING=1
    fi
done <<< "$REMOTE_MIGRATIONS"

if [ $MISSING -eq 0 ]; then
    echo "✅ All remote migrations have corresponding local files"
else
    echo ""
    echo "⚠️  Some remote migrations are missing local files."
    echo "   You may need to create placeholder migration files or reset migration history."
fi
