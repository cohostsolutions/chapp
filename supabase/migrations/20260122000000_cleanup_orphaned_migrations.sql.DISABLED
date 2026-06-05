-- Reset migration tracking to sync with local files
-- This clears orphaned migration records that don't have local files

BEGIN;

-- Drop and recreate the schema_migrations table to clear all orphaned records
DROP TABLE IF EXISTS supabase_migrations.schema_migrations CASCADE;

CREATE TABLE supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  name text,
  statements text[]
);

-- Grant permissions
GRANT ALL ON supabase_migrations.schema_migrations TO postgres;
GRANT ALL ON supabase_migrations.schema_migrations TO authenticated;
GRANT ALL ON supabase_migrations.schema_migrations TO service_role;

COMMIT;

-- Migration tracking table is now reset
-- Deployment workflow will repopulate it with migrations as they're applied


