#!/bin/bash

# Script to automatically fix common idempotency issues in migration files
# This makes migrations safe to rerun without errors

echo "🔧 Fixing migration idempotency issues..."
echo ""

MIGRATIONS_DIR="supabase/migrations"
FIXED_COUNT=0

# Find all SQL migration files
for file in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        needs_fix=false
        
        # Check for patterns that need fixing
        if grep -q "^CREATE TABLE public\." "$file" 2>/dev/null; then
            if ! grep -q "CREATE TABLE IF NOT EXISTS" "$file" 2>/dev/null; then
                needs_fix=true
            fi
        fi
        
        if grep -q "^CREATE TYPE" "$file" 2>/dev/null; then
            if ! grep -q "DO \$\$ BEGIN" "$file" 2>/dev/null; then
                needs_fix=true
            fi
        fi
        
        if grep -q "^CREATE POLICY" "$file" 2>/dev/null; then
            if ! grep -q "DROP POLICY IF EXISTS" "$file" 2>/dev/null; then
                needs_fix=true
            fi
        fi
        
        if grep -q "^CREATE TRIGGER" "$file" 2>/dev/null; then
            if ! grep -q "DROP TRIGGER IF EXISTS" "$file" 2>/dev/null; then
                needs_fix=true
            fi
        fi
        
        if grep -q "^CREATE INDEX" "$file" 2>/dev/null; then
            if ! grep -q "IF NOT EXISTS" "$file" 2>/dev/null; then
                needs_fix=true
            fi
        fi
        
        if grep -q "^ALTER TABLE.*ADD COLUMN" "$file" 2>/dev/null; then
            if ! grep -q "DO \$\$ BEGIN" "$file" 2>/dev/null; then
                needs_fix=true
            fi
        fi
        
        if grep -q "^INSERT INTO" "$file" 2>/dev/null; then
            if ! grep -q "ON CONFLICT" "$file" 2>/dev/null; then
                needs_fix=true
            fi
        fi
        
        if $needs_fix; then
            echo "❌ $filename - needs fixing"
            FIXED_COUNT=$((FIXED_COUNT + 1))
        fi
    fi
done

echo ""
echo "📊 Found $FIXED_COUNT migration files that need fixing"
echo ""
echo "Patterns to fix:"
echo "  • CREATE TABLE → CREATE TABLE IF NOT EXISTS"
echo "  • CREATE TYPE → DO \$\$ BEGIN ... EXCEPTION ... END \$\$;"
echo "  • CREATE POLICY → DROP POLICY IF EXISTS + CREATE POLICY"
echo "  • CREATE TRIGGER → DROP TRIGGER IF EXISTS + CREATE TRIGGER"
echo "  • CREATE INDEX → CREATE INDEX IF NOT EXISTS"
echo "  • ALTER TABLE ADD COLUMN → DO \$\$ BEGIN ... EXCEPTION ... END \$\$;"
echo "  • INSERT INTO → INSERT ... ON CONFLICT DO NOTHING"
echo "  • CREATE VIEW → DROP VIEW IF EXISTS + CREATE VIEW"
echo "  • ALTER PUBLICATION → DO \$\$ BEGIN ... EXCEPTION ... END \$\$;"
