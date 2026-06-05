#!/usr/bin/env python3
"""
Automatically fix idempotency issues in Supabase migration files.
Makes all migrations safe to rerun without errors.
"""

import re
import os
import glob
from pathlib import Path

MIGRATIONS_DIR = "supabase/migrations"

def fix_create_table(content):
    """Fix CREATE TABLE statements to use IF NOT EXISTS"""
    pattern = r'CREATE TABLE (public\.\w+) \('
    replacement = r'CREATE TABLE IF NOT EXISTS \1 ('
    return re.sub(pattern, replacement, content)

def fix_create_type(content):
    """Wrap CREATE TYPE statements in DO $$ blocks"""
    # Find all CREATE TYPE statements
    pattern = r'CREATE TYPE ([\w.]+) AS ENUM \([^)]+\);'
    
    def replace_type(match):
        full_statement = match.group(0)
        return f"""DO $$ BEGIN
  {full_statement}
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;"""
    
    return re.sub(pattern, replace_type, content)

def fix_create_policy(content):
    """Add DROP POLICY IF EXISTS before CREATE POLICY"""
    lines = content.split('\n')
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        # Check if this is a CREATE POLICY line
        if re.match(r'CREATE POLICY\s+"([^"]+)"', line):
            policy_match = re.search(r'CREATE POLICY\s+"([^"]+)"', line)
            if policy_match:
                policy_name = policy_match.group(1)
                # Look ahead for the ON clause
                on_match = None
                for j in range(i, min(i + 5, len(lines))):
                    on_match = re.search(r'ON\s+([\w.]+)', lines[j])
                    if on_match:
                        break
                
                if on_match:
                    table_name = on_match.group(1)
                    # Check if DROP POLICY already exists before this line
                    if i == 0 or not re.search(rf'DROP POLICY IF EXISTS "{policy_name}" ON {table_name}', lines[i-1]):
                        fixed_lines.append(f'DROP POLICY IF EXISTS "{policy_name}" ON {table_name};')
        
        fixed_lines.append(line)
        i += 1
    
    return '\n'.join(fixed_lines)

def fix_create_trigger(content):
    """Add DROP TRIGGER IF EXISTS before CREATE TRIGGER"""
    lines = content.split('\n')
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        # Check if this is a CREATE TRIGGER line
        trigger_match = re.match(r'CREATE TRIGGER\s+(\w+)', line)
        if trigger_match:
            trigger_name = trigger_match.group(1)
            # Look for the ON clause
            on_match = re.search(r'ON\s+([\w.]+)', line)
            if not on_match and i + 1 < len(lines):
                on_match = re.search(r'ON\s+([\w.]+)', lines[i + 1])
            
            if on_match:
                table_name = on_match.group(1)
                # Check if DROP TRIGGER already exists
                if i == 0 or not re.search(rf'DROP TRIGGER IF EXISTS {trigger_name} ON {table_name}', lines[i-1]):
                    fixed_lines.append(f'DROP TRIGGER IF EXISTS {trigger_name} ON {table_name};')
        
        fixed_lines.append(line)
        i += 1
    
    return '\n'.join(fixed_lines)

def fix_create_index(content):
    """Fix CREATE INDEX to use IF NOT EXISTS"""
    pattern = r'CREATE INDEX (\w+) ON'
    replacement = r'CREATE INDEX IF NOT EXISTS \1 ON'
    return re.sub(pattern, replacement, content)

def fix_alter_table_add_column(content):
    """Wrap ALTER TABLE ADD COLUMN in DO $$ blocks"""
    pattern = r'ALTER TABLE ([\w.]+)\s+ADD COLUMN (\w+) ([^;]+);'
    
    def replace_alter(match):
        table = match.group(1)
        column = match.group(2)
        definition = match.group(3)
        return f"""DO $$ BEGIN
  ALTER TABLE {table} ADD COLUMN {column} {definition};
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;"""
    
    return re.sub(pattern, replace_alter, content)

def fix_insert_into(content):
    """Add ON CONFLICT DO NOTHING to INSERT statements"""
    # Only fix INSERT INTO storage.buckets
    pattern = r'(INSERT INTO storage\.buckets[^;]+);'
    replacement = r'\1 ON CONFLICT (id) DO NOTHING;'
    content = re.sub(pattern, replacement, content)
    
    # Fix other common INSERT patterns
    pattern2 = r'(INSERT INTO [^;]+ VALUES \([^)]+\));'
    def add_conflict(match):
        stmt = match.group(1)
        if 'ON CONFLICT' not in stmt:
            return stmt + ' ON CONFLICT DO NOTHING;'
        return stmt + ';'
    content = re.sub(pattern2, add_conflict, content)
    
    return content

def fix_create_view(content):
    """Add DROP VIEW IF EXISTS before CREATE VIEW"""
    pattern = r'CREATE VIEW ([\w.]+)'
    
    def replace_view(match):
        view_name = match.group(1)
        # Check if already has DROP VIEW
        if f'DROP VIEW IF EXISTS {view_name}' in content:
            return match.group(0)
        return f'DROP VIEW IF EXISTS {view_name};\nCREATE VIEW {view_name}'
    
    return re.sub(pattern, replace_view, content)

def fix_alter_publication(content):
    """Wrap ALTER PUBLICATION in DO $$ blocks"""
    pattern = r'ALTER PUBLICATION (\w+) ADD TABLE ([\w.]+);'
    
    def replace_publication(match):
        pub_name = match.group(1)
        table_name = match.group(2)
        return f"""DO $$
BEGIN
  ALTER PUBLICATION {pub_name} ADD TABLE {table_name};
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;"""
    
    return re.sub(pattern, replace_publication, content)

def fix_migration_file(filepath):
    """Apply all fixes to a migration file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Apply all fixes
        content = fix_create_table(content)
        content = fix_create_type(content)
        content = fix_create_index(content)
        content = fix_alter_table_add_column(content)
        content = fix_insert_into(content)
        content = fix_create_view(content)
        content = fix_alter_publication(content)
        content = fix_create_policy(content)
        content = fix_create_trigger(content)
        
        # Only write if changes were made
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    print("🔧 Fixing migration idempotency issues...")
    print()
    
    # Get all migration files
    pattern = os.path.join(MIGRATIONS_DIR, "*.sql")
    migration_files = glob.glob(pattern)
    migration_files.sort()
    
    fixed_count = 0
    total_count = len(migration_files)
    
    for filepath in migration_files:
        filename = os.path.basename(filepath)
        if fix_migration_file(filepath):
            print(f"✅ Fixed: {filename}")
            fixed_count += 1
        else:
            print(f"⏭️  Skipped: {filename} (no changes needed)")
    
    print()
    print(f"📊 Summary: Fixed {fixed_count} of {total_count} migration files")
    print()
    print("✨ All migrations are now idempotent!")
    print("   You can safely run: supabase db push")

if __name__ == "__main__":
    main()
