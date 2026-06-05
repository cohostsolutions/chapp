-- Fix linter: pg_net is a Supabase-managed extension
-- It's already installed in the extensions schema, so no action needed
-- Note: pg_net cannot be dropped via migrations as it's managed by Supabase

CREATE SCHEMA IF NOT EXISTS extensions;

-- pg_net is already created and managed by Supabase, skip recreation
