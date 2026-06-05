-- Drop the overly permissive policy that allows all org users to view all leads
DROP POLICY IF EXISTS "Org users view org leads" ON public.leads;

-- Create a more restrictive policy that limits access based on role and assignment
CREATE POLICY "Users view authorized leads"
ON public.leads
FOR SELECT
USING (
  -- Super admins can see all leads
  has_role(auth.uid(), 'super_admin')
  OR
  -- Client admins can see all leads in their organization
  (has_role(auth.uid(), 'client_admin') AND organization_id = get_user_org(auth.uid()))
  OR
  -- Agents can only see leads assigned to them
  (has_role(auth.uid(), 'agent') AND assigned_agent_id = auth.uid())
  OR
  -- Users can see unassigned leads in their org (for lead pickup)
  (organization_id = get_user_org(auth.uid()) AND assigned_agent_id IS NULL)
);