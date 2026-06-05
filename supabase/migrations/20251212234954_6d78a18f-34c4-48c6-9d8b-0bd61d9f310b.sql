-- Fix security issue: Restrict social_platforms SELECT to admins only
-- Remove the overly permissive "Org users view" policy
DROP POLICY IF EXISTS "Org users view social_platforms" ON public.social_platforms;

-- Create a more restrictive policy for SELECT - only admins can see the base table
DROP POLICY IF EXISTS "Admins view social_platforms" ON public.social_platforms;
CREATE POLICY "Admins view social_platforms" 
ON public.social_platforms 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()))
);

-- Add RLS policy to social_platforms_safe view for non-admin users
-- Note: The view already filters credentials properly via CASE statement
-- Regular org users should use the safe view instead