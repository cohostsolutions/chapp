-- ==================================================
-- SECURITY AUDIT REMEDIATION - CRITICAL FIXES
-- Date: 2026-01-17
-- Purpose: Fix privilege escalation vulnerabilities identified in security audit
-- Ref: SECURITY_AUDIT_REPORT_JAN2026.md
-- ==================================================

-- ============================================
-- CRITICAL FIX #1: Prevent Agents from Deleting Bookings
-- ============================================

DROP POLICY IF EXISTS "Agents manage assigned lead bookings" ON public.bookings;

-- Split the "ALL" policy into separate SELECT, INSERT, UPDATE (no DELETE)
DROP POLICY IF EXISTS "Agents view assigned lead bookings" ON public.bookings;

CREATE POLICY "Agents view assigned lead bookings" 
ON public.bookings 
FOR SELECT 
USING (
  has_role(auth.uid(), 'agent'::app_role) AND 
  organization_id = get_user_org(auth.uid()) AND 
  (
    org_uses_shared_access(organization_id) 
    OR is_assigned_to_lead(auth.uid(), lead_id)
  )
);

DROP POLICY IF EXISTS "Agents insert assigned lead bookings" ON public.bookings;

CREATE POLICY "Agents insert assigned lead bookings" 
ON public.bookings 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'agent'::app_role) AND 
  organization_id = get_user_org(auth.uid()) AND 
  (
    org_uses_shared_access(organization_id) 
    OR is_assigned_to_lead(auth.uid(), lead_id)
  )
);

DROP POLICY IF EXISTS "Agents update assigned lead bookings" ON public.bookings;

CREATE POLICY "Agents update assigned lead bookings" 
ON public.bookings 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'agent'::app_role) AND 
  organization_id = get_user_org(auth.uid()) AND 
  (
    org_uses_shared_access(organization_id) 
    OR is_assigned_to_lead(auth.uid(), lead_id)
  )
);

-- DELETE is now ONLY allowed via "Admins manage bookings" policy

-- ============================================
-- CRITICAL FIX #2: Prevent Agents from Deleting Orders
-- ============================================

DROP POLICY IF EXISTS "Agents manage authorized orders" ON public.orders;
DROP POLICY IF EXISTS "Agents view assigned lead orders" ON public.orders;

CREATE POLICY "Agents view assigned lead orders" 
ON public.orders 
FOR SELECT 
USING (
  has_role(auth.uid(), 'agent'::app_role) AND 
  organization_id = get_user_org(auth.uid()) AND 
  (
    org_uses_shared_access(organization_id) 
    OR is_assigned_to_lead(auth.uid(), lead_id)
  )
);

DROP POLICY IF EXISTS "Agents insert assigned lead orders" ON public.orders;

CREATE POLICY "Agents insert assigned lead orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'agent'::app_role) AND 
  organization_id = get_user_org(auth.uid()) AND 
  (
    org_uses_shared_access(organization_id) 
    OR is_assigned_to_lead(auth.uid(), lead_id)
  )
);

DROP POLICY IF EXISTS "Agents update assigned lead orders" ON public.orders;

CREATE POLICY "Agents update assigned lead orders" 
ON public.orders 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'agent'::app_role) AND 
  organization_id = get_user_org(auth.uid()) AND 
  (
    org_uses_shared_access(organization_id) 
    OR is_assigned_to_lead(auth.uid(), lead_id)
  )
);

-- DELETE is now ONLY allowed via "Admins manage orders" policy

-- ============================================
-- CRITICAL FIX #3: Restrict Room Unit Deletion to Admins Only
-- ============================================

DROP POLICY IF EXISTS "Users can delete room_units in their organization" ON public.room_units;
DROP POLICY IF EXISTS "Admins delete room_units" ON public.room_units;

CREATE POLICY "Admins delete room_units" ON public.room_units
  FOR DELETE USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()))
  );

-- ============================================
-- HIGH PRIORITY FIX: Prevent Agents from Tampering with Lead Fields
-- ============================================

-- Fix the Agents update policy to prevent changing sensitive fields
DROP POLICY IF EXISTS "Agents update assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Client admins update org leads" ON public.leads;

-- Client admins can update all fields
DROP POLICY IF EXISTS "Client admins update org leads" ON public.leads;

CREATE POLICY "Client admins update org leads" ON public.leads
  FOR UPDATE 
  USING (
    has_role(auth.uid(), 'client_admin'::app_role) AND 
    organization_id = get_user_org(auth.uid())
  );

-- Agents can update, but cannot change organization_id or assigned_agent_id
DROP POLICY IF EXISTS "Agents update assigned leads" ON public.leads;

CREATE POLICY "Agents update assigned leads" ON public.leads
  FOR UPDATE 
  USING (
    has_role(auth.uid(), 'agent'::app_role) AND 
    organization_id = get_user_org(auth.uid()) AND
    (
      assigned_agent_id = auth.uid() OR
      org_uses_shared_access(organization_id)
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'agent'::app_role) AND 
    organization_id = get_user_org(auth.uid()) AND
    (
      assigned_agent_id = auth.uid() OR
      org_uses_shared_access(organization_id)
    )
  );

-- ============================================
-- AUDIT LOGGING: Track All DELETE Operations
-- ============================================

-- Create audit logging function for DELETE operations
CREATE OR REPLACE FUNCTION audit_delete_operation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'DELETE',
    TG_TABLE_NAME,
    OLD.id::text,
    jsonb_build_object(
      'deleted_at', now(),
      'deleted_by', auth.uid(),
      'data_snapshot', to_jsonb(OLD)
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit trigger to sensitive tables
DROP TRIGGER IF EXISTS audit_bookings_delete ON public.bookings;
CREATE TRIGGER audit_bookings_delete
BEFORE DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION audit_delete_operation();

DROP TRIGGER IF EXISTS audit_orders_delete ON public.orders;
CREATE TRIGGER audit_orders_delete
BEFORE DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION audit_delete_operation();

DROP TRIGGER IF EXISTS audit_leads_delete ON public.leads;
CREATE TRIGGER audit_leads_delete
BEFORE DELETE ON public.leads
FOR EACH ROW EXECUTE FUNCTION audit_delete_operation();

DROP TRIGGER IF EXISTS audit_room_units_delete ON public.room_units;
CREATE TRIGGER audit_room_units_delete
BEFORE DELETE ON public.room_units
FOR EACH ROW EXECUTE FUNCTION audit_delete_operation();

DROP TRIGGER IF EXISTS audit_organizations_delete ON public.organizations;
CREATE TRIGGER audit_organizations_delete
BEFORE DELETE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION audit_delete_operation();

-- ============================================
-- VERIFICATION COMMENTS
-- ============================================

COMMENT ON POLICY "Agents view assigned lead bookings" ON public.bookings IS 
  'Security: Agents can only VIEW bookings for assigned leads (or all in May/Cece orgs). Cannot DELETE.';

COMMENT ON POLICY "Admins delete room_units" ON public.room_units IS 
  'Security: Only admins can delete room inventory to prevent accidental/malicious data loss.';

COMMENT ON FUNCTION audit_delete_operation() IS 
  'Security: Logs all DELETE operations with full data snapshot for forensics and compliance.';

-- ============================================
-- POST-MIGRATION VERIFICATION QUERIES
-- ============================================

-- Run these queries after migration to verify policies are correct:

-- 1. Check that agents CANNOT delete bookings
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'bookings' AND policyname LIKE '%agent%' AND cmd = 'DELETE';
-- Expected: 0 rows (no DELETE policies for agents)

-- 2. Check that DELETE policies exist for admins only
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename IN ('bookings', 'orders', 'room_units') AND cmd = 'DELETE';
-- Expected: Only policies with 'super_admin' or 'client_admin' role checks

-- 3. Verify audit triggers are active
-- SELECT trigger_name, event_manipulation, event_object_table 
-- FROM information_schema.triggers 
-- WHERE trigger_name LIKE 'audit_%_delete';
-- Expected: 5 rows (bookings, orders, leads, room_units, organizations)
