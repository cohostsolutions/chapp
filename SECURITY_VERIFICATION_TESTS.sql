-- ============================================
-- SECURITY AUDIT VERIFICATION TEST QUERIES
-- Run these after deploying the security fixes
-- ============================================

-- ==========================================
-- TEST 1: Verify Agents Cannot Delete Data
-- ==========================================

-- Check bookings policies (should show SELECT, INSERT, UPDATE only for agents, no DELETE)
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN policyname ILIKE '%agent%' THEN '🔍 Agent Policy'
    ELSE 'Other'
  END as policy_type
FROM pg_policies 
WHERE tablename = 'bookings' 
ORDER BY cmd, policyname;

-- Expected: No "DELETE" policies for agents
-- ✅ PASS: If no rows with cmd='DELETE' and policyname containing 'agent'
-- ❌ FAIL: If any DELETE policies exist for agents


-- ==========================================
-- TEST 2: Verify Orders Policies Fixed
-- ==========================================

SELECT 
  policyname,
  cmd
FROM pg_policies 
WHERE tablename = 'orders' 
  AND policyname ILIKE '%agent%'
ORDER BY cmd;

-- Expected: Should see "Agents view org orders" (SELECT), "Agents insert org orders" (INSERT), "Agents update org orders" (UPDATE)
-- Should NOT see any DELETE policies for agents


-- ==========================================
-- TEST 3: Verify Room Units Policies Fixed
-- ==========================================

SELECT 
  policyname,
  cmd
FROM pg_policies 
WHERE tablename = 'room_units' 
  AND policyname ILIKE '%agent%'
ORDER BY cmd;

-- Expected: Should see SELECT, INSERT, UPDATE only (no DELETE)


-- ==========================================
-- TEST 4: Verify Audit Triggers Exist
-- ==========================================

SELECT 
  trigger_name,
  event_object_table as table_name,
  action_timing,
  event_manipulation as event
FROM information_schema.triggers 
WHERE trigger_name LIKE 'audit_%_delete'
ORDER BY event_object_table;

-- Expected: Should see audit_*_delete triggers for:
-- - bookings
-- - orders  
-- - leads
-- - room_units
-- - organizations


-- ==========================================
-- TEST 5: Verify Audit Function Exists
-- ==========================================

SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_name = 'audit_delete_operation'
  AND routine_schema = 'public';

-- Expected: 1 row showing FUNCTION type


-- ==========================================
-- TEST 6: Verify WITH CHECK Constraints on Leads
-- ==========================================

-- This should show the updated policy with WITH CHECK preventing field tampering
SELECT 
  policyname,
  qual as using_clause,
  with_check
FROM pg_policies 
WHERE tablename = 'leads' 
  AND policyname = 'Agents update assigned leads';

-- Expected: with_check should contain "OLD.organization_id" and "OLD.assigned_agent_id"


-- ==========================================
-- TEST 7: Test Audit Log Structure
-- ==========================================

SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'audit_logs'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Expected columns:
-- - id (uuid)
-- - user_id (uuid)
-- - action (text)
-- - table_name (text)
-- - record_id (text)
-- - old_data (jsonb)
-- - metadata (jsonb)
-- - created_at (timestamp)


-- ==========================================
-- TEST 8: Verify Super Admin Can Still Delete
-- ==========================================

-- Check that client_admin and super_admin DELETE policies still exist
SELECT 
  policyname,
  cmd
FROM pg_policies 
WHERE tablename IN ('bookings', 'orders', 'room_units')
  AND cmd = 'DELETE'
ORDER BY tablename, policyname;

-- Expected: Should see admin DELETE policies (but not agent DELETE policies)


-- ==========================================
-- TEST 9: Simulate Agent Delete Attempt
-- ==========================================

-- Run this as an agent user (will fail with RLS error)
-- DELETE FROM bookings WHERE id = 'some-booking-id';

-- Expected: Permission denied error
-- "new row violates row-level security policy"


-- ==========================================
-- TEST 10: Check Edge Function Exists
-- ==========================================

-- Run in terminal:
-- supabase functions list

-- Expected: Should show "delete-organization" in the list


-- ==========================================
-- SUMMARY CHECKLIST
-- ==========================================

/*
✅ TEST 1: No agent DELETE policies on bookings
✅ TEST 2: No agent DELETE policies on orders
✅ TEST 3: No agent DELETE policies on room_units
✅ TEST 4: Audit triggers exist on 5 critical tables
✅ TEST 5: audit_delete_operation() function exists
✅ TEST 6: WITH CHECK constraints prevent field tampering
✅ TEST 7: audit_logs table has correct schema
✅ TEST 8: Admin DELETE policies still exist
✅ TEST 9: Agent delete attempts are blocked by RLS
✅ TEST 10: delete-organization Edge Function deployed

All tests passing = 🎉 Security fixes successfully deployed!
*/
