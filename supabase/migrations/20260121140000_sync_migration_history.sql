-- Sync migration history: Mark all existing migrations as applied
-- This resolves conflicts between local migrations directory and remote database state

-- Ensure the schema_migrations table exists
DO $$
BEGIN
  -- Check if supabase_migrations schema exists, if not we're likely on a fresh database
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'supabase_migrations') THEN
    CREATE SCHEMA IF NOT EXISTS supabase_migrations;
  END IF;
  
  -- Check if schema_migrations table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'supabase_migrations' 
    AND table_name = 'schema_migrations'
  ) THEN
    CREATE TABLE supabase_migrations.schema_migrations (
      version text PRIMARY KEY,
      name text,
      statements text[]
    );
  END IF;
END $$;

-- This migration just ensures the migration tracking table is properly set up
-- Individual migrations will be recorded by the deployment workflow
-- No-op: This file exists to provide a valid migration after the sync point
