-- Drop the existing policy that exposes unassigned leads to all org users
DROP POLICY IF EXISTS "Users view authorized leads" ON public.leads;

-- Create a more restrictive policy:
-- - Super admins can view all leads
-- - Client admins can view all leads in their organization
-- - Agents can ONLY view leads explicitly assigned to them (not unassigned leads)
CREATE POLICY "Users view authorized leads" 
ON public.leads 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin')
  OR (has_role(auth.uid(), 'client_admin') AND organization_id = get_user_org(auth.uid()))
  OR (has_role(auth.uid(), 'agent') AND assigned_agent_id = auth.uid())
);