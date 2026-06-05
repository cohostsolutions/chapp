#!/bin/bash
# Comprehensive migration fixer
# Run this script to fix all remaining migration idempotency issues

cd /workspaces/canvascapital

echo "🔧 Fixing all migration files for idempotency..."
echo ""

# Fix CREATE TABLE statements
find supabase/migrations -name "*.sql" -exec sed -i 's/^CREATE TABLE public\./CREATE TABLE IF NOT EXISTS public./g' {} \;

# Fix CREATE INDEX statements  
find supabase/migrations -name "*.sql" -exec sed -i 's/^CREATE INDEX \([a-zA-Z0-9_]*\) ON/CREATE INDEX IF NOT EXISTS \1 ON/g' {} \;
find supabase/migrations -name "*.sql" -exec sed -i 's/^CREATE UNIQUE INDEX \([a-zA-Z0-9_]*\) ON/CREATE UNIQUE INDEX IF NOT EXISTS \1 ON/g' {} \;

echo "✅ Fixed CREATE TABLE and CREATE INDEX statements"

# Create a Python script for more complex replacements
python3 << 'EOF'
import os
import re
import glob

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        changed = False
        
        # Fix CREATE TYPE - wrap in DO blocks
        def fix_type(match):
            return f"""DO $$ BEGIN
  {match.group(0)}
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;"""
        
        content = re.sub(
            r'CREATE TYPE [\w.]+ AS ENUM \([^)]+\);',
            fix_type,
            content
        )
        
        # Fix ALTER TABLE ADD COLUMN
        def fix_alter_column(match):
            return f"""DO $$ BEGIN
  {match.group(0)}
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;"""
        
        content = re.sub(
            r'ALTER TABLE [\w.]+ ADD COLUMN [^;]+;',
            fix_alter_column,
            content
        )
        
        # Fix INSERT INTO storage.buckets
        content = re.sub(
            r"(INSERT INTO storage\.buckets \([^)]+\) VALUES \([^)]+\));",
            r"\1 ON CONFLICT (id) DO NOTHING;",
            content
        )
        
        # Fix ALTER PUBLICATION
        def fix_publication(match):
            return f"""DO $$
BEGIN
  {match.group(0)}
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;"""
        
        content = re.sub(
            r'ALTER PUBLICATION \w+ ADD TABLE [\w.]+;',
            fix_publication,
            content
        )
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Error in {filepath}: {e}")
        return False

files = glob.glob('supabase/migrations/*.sql')
fixed = sum(1 for f in files if process_file(f))
print(f"✅ Fixed {fixed} files with complex patterns")
EOF

echo ""
echo "✨ Migration fixes complete!"
echo "   Run: supabase db push"
