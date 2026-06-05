-- ============================================
-- Security Audit: Fix Missing search_path on SECURITY DEFINER Functions
-- ============================================
-- Date: January 21, 2026
-- Issue: Functions with SECURITY DEFINER but no explicit search_path are vulnerable
-- to privilege escalation and schema shadowing attacks

-- Step 1: Find all SECURITY DEFINER functions without search_path
DO $$
DECLARE
  func_record RECORD;
  has_issues BOOLEAN := false;
BEGIN
  RAISE NOTICE '🔍 Auditing SECURITY DEFINER functions...';
  RAISE NOTICE '';
  
  FOR func_record IN
    SELECT 
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_arguments(p.oid) as args,
      CASE 
        WHEN prosecdef THEN 'SECURITY DEFINER'
        ELSE 'SECURITY INVOKER'
      END as security_type,
      COALESCE(array_to_string(proconfig, ', '), 'NONE') as config
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND prosecdef = true  -- SECURITY DEFINER
      AND NOT EXISTS (
        SELECT 1 FROM unnest(proconfig) cfg 
        WHERE cfg LIKE 'search_path=%'
      )
    ORDER BY p.proname
  LOOP
    has_issues := true;
    RAISE WARNING '⚠️  Function: %.%(%)', 
      func_record.schema_name, 
      func_record.function_name,
      func_record.args;
    RAISE WARNING '    Security: %', func_record.security_type;
    RAISE WARNING '    Config: %', func_record.config;
    RAISE WARNING '';
  END LOOP;
  
  IF NOT has_issues THEN
    RAISE NOTICE '✅ All SECURITY DEFINER functions have explicit search_path!';
  ELSE
    RAISE NOTICE '⚠️  Found SECURITY DEFINER functions without search_path (see above)';
    RAISE NOTICE '    These functions should be fixed with:';
    RAISE NOTICE '    ALTER FUNCTION <name>() SET search_path = pg_catalog, public;';
  END IF;
END $$;
