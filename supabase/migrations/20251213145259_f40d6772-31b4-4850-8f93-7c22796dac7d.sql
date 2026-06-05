-- Drop existing agent-restrictive policies for agent_priorities
DROP POLICY IF EXISTS "Users view authorized agent_priorities" ON public.agent_priorities;

-- Create new SELECT policy for agent_priorities
CREATE POLICY "Users view authorized agent_priorities" 
ON public.agent_priorities 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()))
  OR (
    has_role(auth.uid(), 'agent'::app_role) 
    AND organization_id = get_user_org(auth.uid())
    AND (
      -- May/Cece orgs: agents see all agent priorities in their org
      org_uses_shared_access(organization_id)
      -- Jay orgs: agents only see their own priority
      OR agent_id = auth.uid()
    )
  )
);