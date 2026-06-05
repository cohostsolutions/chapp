-- Manual migration reset script
-- Run this in Supabase SQL Editor to clear orphaned migration records
-- 
-- Steps:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Run this entire script
-- 3. Commit and push your code changes

-- Check what migrations are in the tracking table
SELECT 'Current migration records in remote:' as info;
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;

-- Check if there are any problematic records
SELECT 'Orphaned migration records (no local file):' as info;
SELECT version, name FROM supabase_migrations.schema_migrations 
WHERE version NOT IN (
  '20241226120000',
  '20250102170000', -- example version
  '20260105000000',
  '20260106000000',
  '20260107000000',
  '20260108000000',
  '20260109000000',
  '20260110000000',
  '20260110000001',
  '20260110125139',
  '20260110125159',
  '20260111000000',
  '20260111093000',
  '20260112081100',
  '20260113013032',
  '20260117000000',
  '20260117182042',
  '20260117200000',
  '20260117200001',
  '20260117223139',
  '20260118000000',
  '20260121000000',
  '20260121090000',
  '20260121100000',
  '20260121100001',
  '20260121100002',
  '20260121110000',
  '20260121120000',
  '20260121130000',
  '20260122000000',
  '20260122000001'
)
ORDER BY version;

-- RESET: Uncomment and run this if you want to clear ALL migration tracking
-- This will cause the deployment workflow to re-apply all migrations
-- DROP TABLE supabase_migrations.schema_migrations CASCADE;
-- 
-- CREATE TABLE supabase_migrations.schema_migrations (
--   version text PRIMARY KEY,
--   name text,
--   statements text[]
-- );
--
-- GRANT ALL ON supabase_migrations.schema_migrations TO postgres;
-- GRANT ALL ON supabase_migrations.schema_migrations TO authenticated;
-- GRANT ALL ON supabase_migrations.schema_migrations TO service_role;
