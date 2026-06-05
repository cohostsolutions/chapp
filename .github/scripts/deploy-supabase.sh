#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"

echo "Deploying migrations from supabase/migrations/"

# Cache whether the leads table exists to allow repair migrations to run even if recorded.
LEADS_PRESENT=$(psql "$SUPABASE_DB_URL" -t -c "SELECT to_regclass('public.leads');" 2>/dev/null | tr -d '[:space:]' || true)

# Ensure schema_migrations schema exists (idempotent)
# Use escaped $$ so bash doesn't substitute the shell PID.
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'supabase_migrations') THEN EXECUTE 'CREATE SCHEMA supabase_migrations'; END IF; END \$\$;"

# Ensure schema_migrations table exists (idempotent)
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version TEXT PRIMARY KEY, name TEXT, statements TEXT[]);"

# Get list of already-applied migrations from remote
APPLIED_MIGRATIONS=$(psql "$SUPABASE_DB_URL" -t -c "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;" 2>/dev/null || echo "")

shopt -s nullglob
for migration_file in supabase/migrations/*.sql; do
  if [[ -f "$migration_file" ]]; then
    VERSION=$(basename "$migration_file" | cut -d'_' -f1)

    if echo "$APPLIED_MIGRATIONS" | grep -q "^[[:space:]]*$VERSION[[:space:]]*$"; then
      if [[ -z "$LEADS_PRESENT" ]] && [[ "$(basename "$migration_file")" == *"ensure_leads_table"* || "$(basename "$migration_file")" == *"repair_leads_table"* ]]; then
        echo "♻️  Reapplying for missing leads table: $(basename "$migration_file")"
      else
        echo "⏭️  Skipping already applied: $(basename "$migration_file")"
        continue
      fi
    fi

    echo "Applying migration: $(basename "$migration_file")"
    if ! psql "$SUPABASE_DB_URL" -f "$migration_file"; then
      echo "❌ Migration failed: $(basename "$migration_file")"
      exit 1
    fi

    # Record migration in schema_migrations table with conflict handling
    psql "$SUPABASE_DB_URL" -c "INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('$VERSION', '$(basename "$migration_file")', ARRAY['manual']) ON CONFLICT (version) DO NOTHING;" || true

    if [[ -z "$LEADS_PRESENT" ]] && [[ "$(basename "$migration_file")" == *"ensure_leads_table"* || "$(basename "$migration_file")" == *"repair_leads_table"* ]]; then
      LEADS_PRESENT=public.leads
    fi

    echo "✅ Applied: $(basename "$migration_file")"
  fi

done

echo "✅ All migrations deployed successfully"
