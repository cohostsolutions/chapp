-- ============================================================================
-- COMMUNICATIONS DATA ISOLATION DIAGNOSTIC SCRIPT
-- ============================================================================
-- Purpose: Investigate potential cross-organization data contamination
-- Date: January 19, 2026
-- Issue: User reports seeing leads from different organizations
-- ============================================================================

-- Step 1: Check current organizations in the system
-- ============================================================================
SELECT 
  '1. Organizations' as check_type,
  id,
  name,
  slug,
  ai_agent_type,
  created_at
FROM organizations
ORDER BY name;

-- Step 2: Check test user profiles
-- ============================================================================
SELECT 
  '2. Test Users' as check_type,
  id,
  email,
  full_name,
  organization_id,
  (SELECT name FROM organizations WHERE id = profiles.organization_id) as org_name,
  created_at
FROM profiles
WHERE 
  email ILIKE '%test%' 
  OR full_name ILIKE '%test%'
  OR id IN (SELECT user_id FROM user_roles WHERE role = 'client_admin')
ORDER BY created_at DESC;

-- Step 3: Check for communications with mismatched organization_ids
-- ============================================================================
SELECT 
  '3. Mismatched Communications' as check_type,
  c.id as comm_id,
  c.organization_id as comm_org_id,
  (SELECT name FROM organizations WHERE id = c.organization_id) as comm_org_name,
  c.lead_id,
  l.organization_id as lead_org_id,
  (SELECT name FROM organizations WHERE id = l.organization_id) as lead_org_name,
  l.name as lead_name,
  c.channel,
  c.direction,
  LEFT(c.content, 50) as content_preview,
  c.created_at
FROM communications c
LEFT JOIN leads l ON c.lead_id = l.id
WHERE c.organization_id != l.organization_id
ORDER BY c.created_at DESC
LIMIT 20;

-- Step 4: Count communications per organization
-- ============================================================================
SELECT 
  '4. Communications per Org' as check_type,
  o.name as organization,
  COUNT(c.id) as total_communications,
  COUNT(DISTINCT c.lead_id) as unique_leads,
  COUNT(CASE WHEN c.direction = 'inbound' THEN 1 END) as inbound_count,
  COUNT(CASE WHEN c.direction = 'outbound' THEN 1 END) as outbound_count,
  MAX(c.created_at) as last_communication
FROM organizations o
LEFT JOIN communications c ON c.organization_id = o.id
GROUP BY o.id, o.name
ORDER BY total_communications DESC;

-- Step 5: Check leads per organization
-- ============================================================================
SELECT 
  '5. Leads per Org' as check_type,
  o.name as organization,
  COUNT(l.id) as total_leads,
  COUNT(CASE WHEN l.status = 'new' THEN 1 END) as new_leads,
  COUNT(CASE WHEN l.status = 'contacted' THEN 1 END) as contacted_leads,
  COUNT(CASE WHEN l.status = 'converted' THEN 1 END) as converted_leads
FROM organizations o
LEFT JOIN leads l ON l.organization_id = o.id
GROUP BY o.id, o.name
ORDER BY total_leads DESC;

-- Step 6: Check for leads without valid organization
-- ============================================================================
SELECT 
  '6. Orphaned Leads' as check_type,
  l.id,
  l.name,
  l.email,
  l.phone,
  l.organization_id,
  'Organization not found' as issue,
  l.created_at
FROM leads l
LEFT JOIN organizations o ON l.organization_id = o.id
WHERE o.id IS NULL
ORDER BY l.created_at DESC
LIMIT 10;

-- Step 7: Check for communications without valid lead
-- ============================================================================
SELECT 
  '7. Communications without Lead' as check_type,
  c.id,
  c.organization_id,
  (SELECT name FROM organizations WHERE id = c.organization_id) as org_name,
  c.lead_id,
  c.channel,
  c.direction,
  LEFT(c.content, 50) as content_preview,
  c.created_at
FROM communications c
LEFT JOIN leads l ON c.lead_id = l.id
WHERE c.lead_id IS NOT NULL AND l.id IS NULL
ORDER BY c.created_at DESC
LIMIT 10;

-- Step 8: Verify RLS is enabled
-- ============================================================================
SELECT 
  '8. RLS Status' as check_type,
  tablename,
  CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status,
  CASE WHEN rowsecurity THEN '✅' ELSE '❌ CRITICAL' END as status_indicator
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('communications', 'leads', 'organizations', 'profiles')
ORDER BY tablename;

-- Step 9: List all RLS policies on communications table
-- ============================================================================
SELECT 
  '9. Communications RLS Policies' as check_type,
  policyname,
  cmd as command_type,
  CASE 
    WHEN cmd = 'SELECT' THEN 'Read access'
    WHEN cmd = 'INSERT' THEN 'Create access'
    WHEN cmd = 'UPDATE' THEN 'Modify access'
    WHEN cmd = 'DELETE' THEN 'Delete access'
    WHEN cmd = 'ALL' THEN 'Full access'
    ELSE cmd
  END as policy_scope,
  pg_get_expr(qual, 'communications'::regclass) as policy_condition
FROM pg_policies
WHERE tablename = 'communications'
ORDER BY policyname;

-- Step 10: Sample communications for each organization
-- ============================================================================
SELECT 
  '10. Sample Communications' as check_type,
  o.name as organization,
  c.id as comm_id,
  l.name as lead_name,
  c.channel,
  c.direction,
  LEFT(c.content, 30) as content_preview,
  c.created_at
FROM organizations o
LEFT JOIN LATERAL (
  SELECT * FROM communications
  WHERE organization_id = o.id
  ORDER BY created_at DESC
  LIMIT 3
) c ON true
LEFT JOIN leads l ON c.lead_id = l.id
ORDER BY o.name, c.created_at DESC;

-- Step 11: Check for duplicate leads (same phone/email in different orgs)
-- ============================================================================
SELECT 
  '11. Potential Duplicate Leads' as check_type,
  l1.phone,
  l1.email,
  COUNT(DISTINCT l1.organization_id) as org_count,
  STRING_AGG(DISTINCT o.name, ', ') as organizations,
  STRING_AGG(DISTINCT l1.id::text, ', ') as lead_ids
FROM leads l1
JOIN organizations o ON l1.organization_id = o.id
WHERE l1.phone IS NOT NULL OR l1.email IS NOT NULL
GROUP BY l1.phone, l1.email
HAVING COUNT(DISTINCT l1.organization_id) > 1
ORDER BY org_count DESC
LIMIT 10;

-- Step 12: Summary Statistics
-- ============================================================================
SELECT 
  '12. System Summary' as check_type,
  (SELECT COUNT(*) FROM organizations) as total_organizations,
  (SELECT COUNT(*) FROM profiles) as total_users,
  (SELECT COUNT(*) FROM leads) as total_leads,
  (SELECT COUNT(*) FROM communications) as total_communications,
  (SELECT COUNT(*) FROM communications WHERE organization_id != (SELECT organization_id FROM leads WHERE leads.id = communications.lead_id)) as mismatched_communications,
  (SELECT COUNT(*) FROM leads WHERE organization_id IS NULL) as orphaned_leads,
  (SELECT COUNT(*) FROM communications WHERE lead_id IS NOT NULL AND lead_id NOT IN (SELECT id FROM leads)) as orphaned_communications;

-- ============================================================================
-- END OF DIAGNOSTIC SCRIPT
-- ============================================================================
-- 
-- INTERPRETATION GUIDE:
-- 
-- Check 1-2: Identify which organizations and users exist
-- Check 3: CRITICAL - Should be 0 rows. Any rows indicate data corruption
-- Check 4-5: Shows data distribution across organizations
-- Check 6-7: Identifies orphaned/invalid references
-- Check 8: CRITICAL - All tables MUST have RLS enabled
-- Check 9: Lists security policies protecting communications
-- Check 10: Sample data for manual verification
-- Check 11: Identifies potential data duplication issues
-- Check 12: High-level overview of system health
--
-- EXPECTED RESULTS:
-- - Check 3 (Mismatched): 0 rows
-- - Check 6 (Orphaned Leads): 0 rows
-- - Check 7 (Communications without Lead): May have some (broadcast messages)
-- - Check 8 (RLS Status): All ENABLED
-- - Check 11 (Duplicates): Ideally 0, but depends on business logic
-- - Check 12 (Summary): mismatched_communications should be 0
--
-- ============================================================================
