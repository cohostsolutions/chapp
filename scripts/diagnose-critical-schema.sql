-- ============================================
-- Critical Schema Diagnostic
-- ============================================
-- Purpose:
-- Verify the org creation and lead intake paths have the schema,
-- grants, RLS policies, and helper functions they rely on.
--
-- Run this after migrations that touch auth, organizations, or leads.

-- 1. Required columns for organization creation and lead intake
WITH required_columns AS (
  SELECT * FROM (VALUES
    ('organizations','name'),
    ('organizations','slug'),
    ('organizations','ai_agent_type'),
    ('organizations','currency_code'),
    ('organizations','default_country_code'),
    ('organizations','timezone'),
    ('organizations','workflows_enabled'),
    ('organizations','training_enabled'),
    ('organizations','social_feed_enabled'),
    ('organizations','communications_enabled'),
    ('organizations','allowed_languages'),
    ('organizations','language_lock_enabled'),
    ('leads','organization_id'),
    ('leads','name'),
    ('leads','email'),
    ('leads','phone'),
    ('leads','source'),
    ('leads','notes'),
    ('leads','status'),
    ('leads','lead_temperature'),
    ('leads','qualification_status'),
    ('leads','is_ai_managed')
  ) AS v(table_name, column_name)
)
SELECT
  rc.table_name,
  rc.column_name,
  CASE WHEN c.column_name IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS status,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM required_columns rc
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = rc.table_name
 AND c.column_name = rc.column_name
ORDER BY rc.table_name, rc.column_name;

-- 2. Table privileges required by the browser client
SELECT
  table_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('organizations', 'leads', 'profiles', 'user_roles')
  AND grantee = 'authenticated'
GROUP BY table_name, grantee
ORDER BY table_name;

-- 3. RLS policies covering org creation and lead management
SELECT
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'leads')
ORDER BY tablename, policyname;

-- 4. Helper functions used by policy evaluation
SELECT
  proname,
  prosecdef,
  COALESCE(array_to_string(proconfig, ', '), '') AS config
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('has_role_text', 'get_user_org', 'current_user_role', 'get_effective_role')
ORDER BY proname;

-- 5. Constraint summary for critical tables
SELECT
  rel.relname AS table_name,
  con.conname AS constraint_name,
  con.contype AS constraint_type,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname IN ('organizations', 'leads')
ORDER BY rel.relname, con.conname;

-- Manual probe to run separately if needed:
-- Begin a transaction as an authenticated super admin, insert an organization,
-- then insert a lead referencing it, and roll the transaction back.