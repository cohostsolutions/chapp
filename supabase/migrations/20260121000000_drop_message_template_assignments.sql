-- ============================================
-- Drop Orphaned Table: message_template_assignments
-- ============================================
-- Date: January 21, 2026
-- Reason: Table exists but has no code usage, no RLS, and poses security risk
-- Investigation: See MESSAGE_TEMPLATE_ASSIGNMENTS_FALSE_POSITIVE.md
--
-- SAFETY FEATURES:
-- 1. Creates backup table with all data
-- 2. Verifies table exists and checks for data
-- 3. Drops original table safely
-- 4. Provides rollback instructions
-- 5. Backup table expires after 7 days (manual cleanup)

-- ============================================
-- STEP 1: Safety Checks
-- ============================================
DO $$
DECLARE
  table_exists boolean;
  has_rls boolean;
  row_count integer;
BEGIN
  -- Check if table exists
  SELECT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'message_template_assignments'
  ) INTO table_exists;

  IF NOT table_exists THEN
    RAISE NOTICE '✅ Table message_template_assignments does not exist. Skipping migration.';
    RETURN;
  END IF;

  -- Check RLS status
  SELECT relrowsecurity INTO has_rls
  FROM pg_class
  WHERE relname = 'message_template_assignments'
  AND relnamespace = 'public'::regnamespace;

  -- Count existing rows
  EXECUTE 'SELECT COUNT(*) FROM public.message_template_assignments' INTO row_count;

  -- Log status
  RAISE NOTICE '📊 Table message_template_assignments found:';
  RAISE NOTICE '  - RLS enabled: %', has_rls;
  RAISE NOTICE '  - Row count: %', row_count;
  RAISE NOTICE '';

  IF NOT has_rls THEN
    RAISE WARNING '⚠️  RLS is DISABLED - this table has no access control!';
  END IF;

  IF row_count > 0 THEN
    RAISE NOTICE '📦 Table contains % rows - creating backup...', row_count;
  ELSE
    RAISE NOTICE '✅ Table is empty - safe to drop.';
  END IF;
END $$;

-- ============================================
-- STEP 2: Create Backup (with expiration notice)
-- ============================================
DO $$
DECLARE
  row_count integer;
BEGIN
  -- Only create backup if original table exists
  IF EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'message_template_assignments'
  ) THEN
    -- Drop old backup if exists
    DROP TABLE IF EXISTS public._backup_message_template_assignments CASCADE;
    
    -- Create backup with structure only
    CREATE TABLE public._backup_message_template_assignments AS 
    TABLE public.message_template_assignments WITH NO DATA;
    
    -- Copy all data
    INSERT INTO public._backup_message_template_assignments 
    SELECT * FROM public.message_template_assignments;
    
    -- Get count
    SELECT COUNT(*) INTO row_count FROM public._backup_message_template_assignments;
    
    RAISE NOTICE '✅ Backup created: _backup_message_template_assignments (% rows)', row_count;
    RAISE NOTICE '⏰ Backup expires: % (manual cleanup required)', (now() + interval '7 days')::date;
    RAISE NOTICE '';
  END IF;
END $$;

-- ============================================
-- STEP 3: Drop Original Table
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'message_template_assignments'
  ) THEN
    RAISE NOTICE '🗑️  Dropping table message_template_assignments...';
    DROP TABLE public.message_template_assignments CASCADE;
    RAISE NOTICE '✅ Table dropped successfully.';
    RAISE NOTICE '';
  END IF;
END $$;

-- ============================================
-- STEP 4: Verify Completion
-- ============================================
DO $$
DECLARE
  backup_exists boolean;
  original_exists boolean;
BEGIN
  -- Check if original is gone
  SELECT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'message_template_assignments'
  ) INTO original_exists;

  -- Check if backup exists
  SELECT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = '_backup_message_template_assignments'
  ) INTO backup_exists;

  IF original_exists THEN
    RAISE EXCEPTION '❌ FAILED: Original table still exists after drop!';
  END IF;

  RAISE NOTICE '✅ MIGRATION COMPLETE';
  RAISE NOTICE '  - Original table: DROPPED';
  RAISE NOTICE '  - Backup table: %', CASE WHEN backup_exists THEN 'EXISTS' ELSE 'N/A (was empty)' END;
  RAISE NOTICE '';
  RAISE NOTICE '📝 To rollback, see: MESSAGE_TEMPLATE_ASSIGNMENTS_FALSE_POSITIVE.md';
  RAISE NOTICE '🧹 To cleanup backup: DROP TABLE public._backup_message_template_assignments;';
END $$;

-- ============================================
-- ROLLBACK INSTRUCTIONS (DO NOT EXECUTE - FOR REFERENCE ONLY)
-- ============================================
/*
-- If you need to restore the table, run this:

-- 1. Recreate table structure
CREATE TABLE public.message_template_assignments (
  template_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (template_id, user_id)
);

-- 2. Restore foreign keys
ALTER TABLE public.message_template_assignments 
  ADD CONSTRAINT message_template_assignments_template_id_fkey 
  FOREIGN KEY (template_id) 
  REFERENCES public.message_templates(id) 
  ON DELETE CASCADE;

ALTER TABLE public.message_template_assignments 
  ADD CONSTRAINT message_template_assignments_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- 3. Recreate indexes
CREATE INDEX idx_message_template_assignments_user 
  ON public.message_template_assignments (user_id, template_id);

-- 4. Restore data from backup
INSERT INTO public.message_template_assignments 
SELECT * FROM public._backup_message_template_assignments;

-- 5. Clean up backup
DROP TABLE public._backup_message_template_assignments;

-- 6. (Optional) Enable RLS if you plan to use this table
ALTER TABLE public.message_template_assignments ENABLE ROW LEVEL SECURITY;

-- Add appropriate policies here
*/
