-- Add policy for organization members to view profiles within their own organization
-- This ensures proper cross-organization isolation while allowing legitimate access
CREATE POLICY "Org members can view org profiles"
ON public.profiles
FOR SELECT
USING (
  -- Users can always see their own profile
  auth.uid() = id
  OR
  -- Users can see profiles in their organization
  (organization_id IS NOT NULL AND organization_id = get_user_org(auth.uid()))
  OR
  -- Super admins can see all profiles
  has_role(auth.uid(), 'super_admin')
);