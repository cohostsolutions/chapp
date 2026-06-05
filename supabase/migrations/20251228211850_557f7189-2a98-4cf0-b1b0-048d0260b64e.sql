-- Add policies for super admins to access ALL organization assets for migration purposes
-- These only apply when super admin is NOT impersonating

-- Leads: Allow super admins to view AND update leads across ALL orgs for migration
DROP POLICY IF EXISTS "Super admins migrate all leads" ON leads;
CREATE POLICY "Super admins migrate all leads" 
ON leads 
FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
);

-- Social platforms: Allow super admins to view AND update across ALL orgs for migration
DROP POLICY IF EXISTS "Super admins migrate all social_platforms" ON social_platforms;
CREATE POLICY "Super admins migrate all social_platforms" 
ON social_platforms 
FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
);

-- Also need to update the org-specific policies to not conflict
-- Drop the org-restricted policies for super admins since migration policy covers it
DROP POLICY IF EXISTS "Super admins view org leads" ON leads;
DROP POLICY IF EXISTS "Super admins manage org leads" ON leads;
DROP POLICY IF EXISTS "Super admins manage org social_platforms" ON social_platforms;