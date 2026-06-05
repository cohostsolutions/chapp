-- ============================================
-- Verification Script: message_templates Table
-- ============================================
-- Purpose: Verify that only message_templates exists (not message_template_assignments)
-- Date: January 21, 2026
-- Context: Addressing false positive lint finding

-- Step 1: Check if message_template_assignments exists (should return 0 rows)
SELECT 
  schemaname, 
  tablename,
  tableowner
FROM pg_tables 
WHERE tablename LIKE '%message_template%'
  AND schemaname = 'public'
ORDER BY tablename;

-- Expected Output:
-- schemaname | tablename         | tableowner
-- -----------|-------------------|------------
-- public     | message_templates | postgres

-- Step 2: Verify message_templates structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'message_templates'
ORDER BY ordinal_position;

-- Expected columns:
-- - id (uuid)
-- - organization_id (uuid) <- KEY: Organization-scoped
-- - name (text)
-- - channel (text)
-- - subject (text, nullable)
-- - content (text)
-- - variables (jsonb)
-- - is_active (boolean)
-- - created_by (uuid, nullable)
-- - created_at (timestamp with time zone)
-- - updated_at (timestamp with time zone)

-- Step 3: Verify RLS policies on message_templates
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'message_templates'
ORDER BY policyname;

-- Expected policies:
-- 1. "Users can view message templates in their organization" (SELECT)
-- 2. "Client admins manage org message templates" (ALL)
-- 3. "Super admins manage all message templates" (ALL)

-- Step 4: Check for any views or functions referencing message_template_assignments
SELECT 
  routine_schema,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_definition ILIKE '%message_template_assignment%'
  AND routine_schema = 'public';

-- Expected: 0 rows (no stale references)

-- Step 5: Check for foreign keys referencing message_templates
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (tc.table_name = 'message_templates' OR ccu.table_name = 'message_templates');

-- Step 6: Verify RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'message_templates'
  AND schemaname = 'public';

-- Expected: rowsecurity = true

-- ============================================
-- CONCLUSION
-- ============================================
-- If message_template_assignments does NOT appear in any results above,
-- the lint finding is a FALSE POSITIVE caused by:
-- 1. Cached metadata in CI/CD pipeline
-- 2. Stale database connection in linting tool
-- 3. Reference to a planned table that was never created
--
-- REMEDIATION:
-- 1. Run this script to document current state
-- 2. Clear Supabase CLI cache: rm -rf ~/.supabase/
-- 3. Re-run lint/advisor tools with fresh connection
-- 4. Update any documentation mentioning message_template_assignments
