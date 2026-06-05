-- Drop remaining leads policies that weren't dropped
DROP POLICY IF EXISTS "Client admins manage org leads" ON leads;
DROP POLICY IF EXISTS "Super admins view org leads" ON leads;
DROP POLICY IF EXISTS "Super admins manage org leads" ON leads;
DROP POLICY IF EXISTS "Agents view authorized leads" ON leads;
DROP POLICY IF EXISTS "Agents update authorized leads" ON leads;
DROP POLICY IF EXISTS "Agents insert org leads" ON leads;

-- Super admins can view/manage leads only in their own organization
CREATE POLICY "Super admins view org leads" 
ON leads 
FOR SELECT 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Super admins manage org leads" 
ON leads 
FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND organization_id = get_user_org(auth.uid())
);

-- Client admins can manage all leads in their organization
CREATE POLICY "Client admins manage org leads" 
ON leads 
FOR ALL 
USING (
    has_role(auth.uid(), 'client_admin'::app_role) 
    AND organization_id = get_user_org(auth.uid())
);

-- Agents can view leads they are assigned to or if shared access is enabled
CREATE POLICY "Agents view authorized leads" 
ON leads 
FOR SELECT 
USING (
    has_role(auth.uid(), 'agent'::app_role) 
    AND organization_id = get_user_org(auth.uid()) 
    AND (
        org_uses_shared_access(organization_id) 
        OR assigned_agent_id = auth.uid()
    )
);

-- Agents can update leads they are assigned to or if shared access is enabled
CREATE POLICY "Agents update authorized leads" 
ON leads 
FOR UPDATE 
USING (
    has_role(auth.uid(), 'agent'::app_role) 
    AND organization_id = get_user_org(auth.uid()) 
    AND (
        org_uses_shared_access(organization_id) 
        OR assigned_agent_id = auth.uid()
    )
);

-- Agents can insert leads in their organization
CREATE POLICY "Agents insert org leads" 
ON leads 
FOR INSERT 
WITH CHECK (
    has_role(auth.uid(), 'agent'::app_role) 
    AND organization_id = get_user_org(auth.uid())
);