-- Update communications RLS
DROP POLICY IF EXISTS "Users view authorized communications" ON communications;
DROP POLICY IF EXISTS "Users create authorized communications" ON communications;
DROP POLICY IF EXISTS "Users update authorized communications" ON communications;

CREATE POLICY "Super admins manage org communications" 
ON communications FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating client admin manage communications" 
ON communications FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating agent view communications" 
ON communications FOR SELECT 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND organization_id = get_user_org(auth.uid())
    AND (org_uses_shared_access(organization_id) OR lead_id IS NULL OR is_assigned_to_lead(auth.uid(), lead_id))
);

CREATE POLICY "Impersonating agent manage communications" 
ON communications FOR INSERT 
WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating agent update communications" 
ON communications FOR UPDATE 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND organization_id = get_user_org(auth.uid())
    AND (org_uses_shared_access(organization_id) OR lead_id IS NULL OR is_assigned_to_lead(auth.uid(), lead_id))
);

CREATE POLICY "Client admins manage org communications" 
ON communications FOR ALL 
USING (
    has_role(auth.uid(), 'client_admin'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Agents view authorized communications" 
ON communications FOR SELECT 
USING (
    has_role(auth.uid(), 'agent'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND NOT has_role(auth.uid(), 'client_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
    AND (org_uses_shared_access(organization_id) OR lead_id IS NULL OR is_assigned_to_lead(auth.uid(), lead_id))
);

CREATE POLICY "Agents create communications" 
ON communications FOR INSERT 
WITH CHECK (
    has_role(auth.uid(), 'agent'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND NOT has_role(auth.uid(), 'client_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Agents update authorized communications" 
ON communications FOR UPDATE 
USING (
    has_role(auth.uid(), 'agent'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND NOT has_role(auth.uid(), 'client_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
    AND (org_uses_shared_access(organization_id) OR lead_id IS NULL OR is_assigned_to_lead(auth.uid(), lead_id))
);

-- Update calendar_events RLS
DROP POLICY IF EXISTS "Admins manage calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Admins view all calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Agents manage authorized calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Agents view authorized calendar events" ON calendar_events;

CREATE POLICY "Super admins manage org calendar events" 
ON calendar_events FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating client admin manage calendar events" 
ON calendar_events FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating agent manage calendar events" 
ON calendar_events FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND organization_id = get_user_org(auth.uid())
    AND (org_uses_shared_access(organization_id) OR user_id = auth.uid())
);

CREATE POLICY "Client admins manage org calendar events" 
ON calendar_events FOR ALL 
USING (
    has_role(auth.uid(), 'client_admin'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Agents manage authorized calendar events" 
ON calendar_events FOR ALL 
USING (
    has_role(auth.uid(), 'agent'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND NOT has_role(auth.uid(), 'client_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
    AND (org_uses_shared_access(organization_id) OR user_id = auth.uid())
);