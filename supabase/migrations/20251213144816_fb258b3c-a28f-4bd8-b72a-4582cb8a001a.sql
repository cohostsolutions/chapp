-- Drop existing agent-restrictive policies for communications
DROP POLICY IF EXISTS "Users view authorized communications" ON public.communications;
DROP POLICY IF EXISTS "Users create authorized communications" ON public.communications;
DROP POLICY IF EXISTS "Users update authorized communications" ON public.communications;

-- Create new SELECT policy that allows May/Cece org agents to see all communications in their org
CREATE POLICY "Users view authorized communications" 
ON public.communications 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()))
  OR (
    has_role(auth.uid(), 'agent'::app_role) 
    AND organization_id = get_user_org(auth.uid())
    AND (
      -- May/Cece orgs: agents see all communications in their org
      org_uses_shared_access(organization_id)
      -- Jay orgs: agents only see communications for assigned leads or org-wide (lead_id IS NULL)
      OR lead_id IS NULL
      OR is_assigned_to_lead(auth.uid(), lead_id)
    )
  )
);

-- Create new INSERT policy
CREATE POLICY "Users create authorized communications" 
ON public.communications 
FOR INSERT 
WITH CHECK (
  organization_id = get_user_org(auth.uid())
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'client_admin'::app_role)
    OR (
      has_role(auth.uid(), 'agent'::app_role)
      AND (
        org_uses_shared_access(organization_id)
        OR lead_id IS NULL
        OR is_assigned_to_lead(auth.uid(), lead_id)
      )
    )
  )
);

-- Create new UPDATE policy
CREATE POLICY "Users update authorized communications" 
ON public.communications 
FOR UPDATE 
USING (
  organization_id = get_user_org(auth.uid())
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'client_admin'::app_role)
    OR (
      has_role(auth.uid(), 'agent'::app_role)
      AND (
        org_uses_shared_access(organization_id)
        OR lead_id IS NULL
        OR is_assigned_to_lead(auth.uid(), lead_id)
      )
    )
  )
);