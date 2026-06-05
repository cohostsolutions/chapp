-- Allow client admins to view roles for users in their organization
CREATE POLICY "Client admins can view roles for org users"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles caller_profile
    WHERE caller_profile.id = auth.uid()
    AND has_role(auth.uid(), 'client_admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles target_profile
      WHERE target_profile.id = user_roles.user_id
      AND target_profile.organization_id = caller_profile.organization_id
    )
  )
);