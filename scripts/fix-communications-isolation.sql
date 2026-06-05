-- ============================================================================
-- COMMUNICATIONS DATA ISOLATION FIX SCRIPT
-- ============================================================================
-- Purpose: Fix cross-organization data contamination issues
-- Date: January 19, 2026
-- WARNING: Run diagnostic script first to understand the scope of issues
-- WARNING: Take a database backup before running this script
-- ============================================================================

-- IMPORTANT: Uncomment and run each section ONLY after reviewing the diagnostic results

-- ============================================================================
-- Section 1: Fix communications with mismatched organization_ids
-- ============================================================================
-- This updates communications to match their lead's organization_id
-- RUN DIAGNOSTIC FIRST to see how many records will be affected

-- PREVIEW: See what will be changed
SELECT 
  c.id as comm_id,
  c.organization_id as current_org_id,
  l.organization_id as correct_org_id,
  (SELECT name FROM organizations WHERE id = c.organization_id) as current_org_name,
  (SELECT name FROM organizations WHERE id = l.organization_id) as correct_org_name,
  l.name as lead_name,
  c.created_at
FROM communications c
INNER JOIN leads l ON c.lead_id = l.id
WHERE c.organization_id != l.organization_id
ORDER BY c.created_at DESC;

-- EXECUTE FIX (uncomment when ready):
/*
UPDATE communications c
SET organization_id = l.organization_id
FROM leads l
WHERE c.lead_id = l.id
  AND c.organization_id != l.organization_id;
-- Returns number of rows updated
*/

-- ============================================================================
-- Section 2: Handle orphaned communications (lead_id points to non-existent lead)
-- ============================================================================
-- Option A: Delete orphaned communications
-- Option B: Set lead_id to NULL (for broadcast/system messages)
-- Choose based on business requirements

-- PREVIEW: See orphaned communications
SELECT 
  c.id,
  c.organization_id,
  c.lead_id,
  c.channel,
  c.direction,
  LEFT(c.content, 50) as content_preview,
  c.created_at
FROM communications c
WHERE c.lead_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM leads WHERE id = c.lead_id)
ORDER BY c.created_at DESC;

-- OPTION A: Delete orphaned communications (uncomment when ready):
/*
DELETE FROM communications c
WHERE c.lead_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM leads WHERE id = c.lead_id);
*/

-- OPTION B: Nullify lead_id for orphaned communications (uncomment when ready):
/*
UPDATE communications
SET lead_id = NULL
WHERE lead_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM leads WHERE id = lead_id);
*/

-- ============================================================================
-- Section 3: Handle orphaned leads (organization_id points to non-existent org)
-- ============================================================================
-- This is CRITICAL and requires manual intervention
-- DO NOT delete leads without understanding the business impact

-- PREVIEW: See orphaned leads
SELECT 
  l.id,
  l.name,
  l.email,
  l.phone,
  l.organization_id,
  l.status,
  l.created_at,
  (SELECT COUNT(*) FROM communications WHERE lead_id = l.id) as communication_count
FROM leads l
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE id = l.organization_id)
ORDER BY l.created_at DESC;

-- Manual action required:
-- 1. Identify which organization these leads should belong to
-- 2. Update the organization_id for each lead
-- 3. Example: UPDATE leads SET organization_id = 'correct-org-id' WHERE id = 'lead-id';

-- ============================================================================
-- Section 4: Add database constraints to prevent future issues
-- ============================================================================

-- Add foreign key constraint on communications.organization_id (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'communications_organization_id_fkey'
  ) THEN
    ALTER TABLE communications
      ADD CONSTRAINT communications_organization_id_fkey
      FOREIGN KEY (organization_id)
      REFERENCES organizations(id)
      ON DELETE CASCADE;
    RAISE NOTICE 'Added foreign key constraint: communications_organization_id_fkey';
  ELSE
    RAISE NOTICE 'Constraint communications_organization_id_fkey already exists';
  END IF;
END $$;

-- Add foreign key constraint on communications.lead_id (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'communications_lead_id_fkey'
  ) THEN
    ALTER TABLE communications
      ADD CONSTRAINT communications_lead_id_fkey
      FOREIGN KEY (lead_id)
      REFERENCES leads(id)
      ON DELETE CASCADE;
    RAISE NOTICE 'Added foreign key constraint: communications_lead_id_fkey';
  ELSE
    RAISE NOTICE 'Constraint communications_lead_id_fkey already exists';
  END IF;
END $$;

-- Add foreign key constraint on leads.organization_id (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leads_organization_id_fkey'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_organization_id_fkey
      FOREIGN KEY (organization_id)
      REFERENCES organizations(id)
      ON DELETE CASCADE;
    RAISE NOTICE 'Added foreign key constraint: leads_organization_id_fkey';
  ELSE
    RAISE NOTICE 'Constraint leads_organization_id_fkey already exists';
  END IF;
END $$;

-- ============================================================================
-- Section 5: Create audit trigger to log organization changes
-- ============================================================================

-- Create audit log table
CREATE TABLE IF NOT EXISTS communications_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID NOT NULL,
  old_organization_id UUID,
  new_organization_id UUID,
  old_lead_id UUID,
  new_lead_id UUID,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  change_reason TEXT
);

-- Create trigger function
CREATE OR REPLACE FUNCTION audit_communications_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.organization_id != NEW.organization_id OR OLD.lead_id != NEW.lead_id) THEN
    INSERT INTO communications_audit_log (
      communication_id,
      old_organization_id,
      new_organization_id,
      old_lead_id,
      new_lead_id,
      changed_by,
      change_reason
    ) VALUES (
      NEW.id,
      OLD.organization_id,
      NEW.organization_id,
      OLD.lead_id,
      NEW.lead_id,
      auth.uid(),
      'Automated or manual update'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS communications_audit_trigger ON communications;
CREATE TRIGGER communications_audit_trigger
  AFTER UPDATE ON communications
  FOR EACH ROW
  WHEN (OLD.organization_id IS DISTINCT FROM NEW.organization_id 
     OR OLD.lead_id IS DISTINCT FROM NEW.lead_id)
  EXECUTE FUNCTION audit_communications_changes();

-- ============================================================================
-- Section 6: Verification queries after fixes
-- ============================================================================

-- Verify no mismatched communications remain
SELECT 
  'Verification: Mismatched Communications' as check_type,
  COUNT(*) as mismatch_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ PASS'
    ELSE '❌ FAIL - Still have mismatched records'
  END as status
FROM communications c
INNER JOIN leads l ON c.lead_id = l.id
WHERE c.organization_id != l.organization_id;

-- Verify no orphaned communications remain
SELECT 
  'Verification: Orphaned Communications' as check_type,
  COUNT(*) as orphan_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ PASS'
    ELSE '⚠️  WARNING - Still have orphaned communications (may be intentional)'
  END as status
FROM communications c
WHERE c.lead_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM leads WHERE id = c.lead_id);

-- Verify no orphaned leads remain
SELECT 
  'Verification: Orphaned Leads' as check_type,
  COUNT(*) as orphan_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ PASS'
    ELSE '❌ FAIL - Still have orphaned leads'
  END as status
FROM leads l
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE id = l.organization_id);

-- Verify foreign key constraints exist
SELECT 
  'Verification: Foreign Key Constraints' as check_type,
  COUNT(*) as constraint_count,
  CASE 
    WHEN COUNT(*) >= 3 THEN '✅ PASS'
    ELSE '❌ FAIL - Missing constraints'
  END as status
FROM pg_constraint
WHERE conname IN (
  'communications_organization_id_fkey',
  'communications_lead_id_fkey',
  'leads_organization_id_fkey'
);

-- ============================================================================
-- END OF FIX SCRIPT
-- ============================================================================
--
-- POST-FIX CHECKLIST:
-- [ ] All verification checks pass
-- [ ] Re-run diagnostic script to confirm no issues
-- [ ] Test user access in the application
-- [ ] Verify each organization only sees their own data
-- [ ] Check audit logs for any unexpected changes
-- [ ] Document what was fixed and when
--
-- ============================================================================
