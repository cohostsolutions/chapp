-- Drop the overly permissive policy that allows all org members to view all org profiles
DROP POLICY IF EXISTS "Org members can view org profiles" ON public.profiles;

-- Drop redundant individual policies to consolidate into one clear policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Client admins can view org profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;

-- Create a single consolidated SELECT policy with proper restrictions
CREATE POLICY "Users view authorized profiles"
ON public.profiles
FOR SELECT
USING (
  -- Users can always see their own profile
  auth.uid() = id
  OR
  -- Client admins can see profiles in their organization
  (has_role(auth.uid(), 'client_admin') AND organization_id = get_user_org(auth.uid()))
  OR
  -- Super admins can see all profiles
  has_role(auth.uid(), 'super_admin')
);