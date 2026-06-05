-- Drop existing agent-restrictive policies for leads
DROP POLICY IF EXISTS "Users view authorized leads" ON public.leads;
DROP POLICY IF EXISTS "Agents update assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Agents update authorized leads" ON public.leads;

-- Create new SELECT policy that allows May/Cece org agents to see all leads in their org
CREATE POLICY "Users view authorized leads" 
ON public.leads 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()))
  OR (
    has_role(auth.uid(), 'agent'::app_role) 
    AND organization_id = get_user_org(auth.uid())
    AND (
      -- May/Cece orgs: agents see all leads in their org
      org_uses_shared_access(organization_id)
      -- Jay orgs: agents only see assigned leads
      OR assigned_agent_id = auth.uid()
    )
  )
);

-- Create new UPDATE policy for agents
CREATE POLICY "Agents update authorized leads" 
ON public.leads 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'agent'::app_role)
  AND organization_id = get_user_org(auth.uid())
  AND (
    org_uses_shared_access(organization_id)
    OR assigned_agent_id = auth.uid()
  )
);