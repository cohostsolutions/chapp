-- Enforce Row Level Security on leads table
-- SECURITY: Prevents cross-organization data access
-- Date: January 25, 2026

-- Step 0: Ensure the user_role column exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS user_role text DEFAULT 'user';

-- Step 1: Enable RLS on leads table
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop any existing conflicting policies
DROP POLICY IF EXISTS "Users can view leads in their organization" ON public.leads;
DROP POLICY IF EXISTS "Users can create leads in their organization" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads in their organization" ON public.leads;
DROP POLICY IF EXISTS "Users can delete leads in their organization" ON public.leads;

-- Step 3: CREATE SELECT policy - Users can view leads in their organization
CREATE POLICY "Users can view leads in their organization"
  ON public.leads
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- Step 4: CREATE INSERT policy - Users can create leads in their organization
-- Ensures they cannot inject leads for other organizations
CREATE POLICY "Users can create leads in their organization"
  ON public.leads
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- Step 5: CREATE UPDATE policy - Users can update leads in their organization
CREATE POLICY "Users can update leads in their organization"
  ON public.leads
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.profiles
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    -- Prevent changing organization_id to another org
    organization_id IN (
      SELECT organization_id 
      FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- Step 6: CREATE DELETE policy - Only admins can delete leads
CREATE POLICY "Admins can delete leads in their organization"
  ON public.leads
  FOR DELETE
  USING (
    -- User must be in the same organization
    organization_id IN (
      SELECT organization_id 
      FROM public.profiles
      WHERE id = auth.uid()
    )
    -- User must have admin role
    AND (
      SELECT user_role 
      FROM public.profiles
      WHERE id = auth.uid()
    ) IN ('super_admin', 'client_admin')
  );

-- VERIFICATION STEPS (run in Supabase Studio SQL editor):
-- 1. As Agent User (Org A):
--    SELECT COUNT(*) FROM leads; -- Should return only Org A leads
-- 2. Try cross-org insert:
--    INSERT INTO leads (organization_id, name) VALUES ('orgB_uuid', 'Test'); -- Should FAIL
-- 3. Verify RLS is enabled:
--    SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename='leads';
--    Should show: public | leads | t (true)

COMMENT ON POLICY "Users can view leads in their organization" ON public.leads 
  IS 'RLS: Only users can view leads from their own organization';
COMMENT ON POLICY "Users can create leads in their organization" ON public.leads 
  IS 'RLS: Users can only create leads in their organization';
COMMENT ON POLICY "Users can update leads in their organization" ON public.leads 
  IS 'RLS: Users can only update leads in their organization';
COMMENT ON POLICY "Admins can delete leads in their organization" ON public.leads 
  IS 'RLS: Only admins can delete leads from their organization';
