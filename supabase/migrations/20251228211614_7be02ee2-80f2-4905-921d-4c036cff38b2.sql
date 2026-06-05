-- Update training_modules RLS
DROP POLICY IF EXISTS "Super admins manage all training_modules" ON training_modules;
DROP POLICY IF EXISTS "Client admins manage org training_modules" ON training_modules;
DROP POLICY IF EXISTS "Users view org training_modules" ON training_modules;

CREATE POLICY "Super admins manage org training_modules" 
ON training_modules FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating client admin manage training_modules" 
ON training_modules FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating agent view training_modules" 
ON training_modules FOR SELECT 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Client admins manage org training_modules" 
ON training_modules FOR ALL 
USING (
    has_role(auth.uid(), 'client_admin'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Org users view training_modules" 
ON training_modules FOR SELECT 
USING (
    organization_id = get_user_org(auth.uid())
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND NOT has_role(auth.uid(), 'client_admin'::app_role)
);

-- Update training_sessions RLS
DROP POLICY IF EXISTS "Super admins manage all training_sessions" ON training_sessions;
DROP POLICY IF EXISTS "Client admins manage org training_sessions" ON training_sessions;
DROP POLICY IF EXISTS "Users can view their own training_sessions" ON training_sessions;
DROP POLICY IF EXISTS "Users can insert their own training_sessions" ON training_sessions;

CREATE POLICY "Super admins manage org training_sessions" 
ON training_sessions FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating client admin manage training_sessions" 
ON training_sessions FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating agent own training_sessions" 
ON training_sessions FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND organization_id = get_user_org(auth.uid())
    AND user_id = auth.uid()
);

CREATE POLICY "Client admins manage org training_sessions" 
ON training_sessions FOR ALL 
USING (
    has_role(auth.uid(), 'client_admin'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Users manage own training_sessions" 
ON training_sessions FOR ALL 
USING (
    organization_id = get_user_org(auth.uid())
    AND user_id = auth.uid()
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND NOT has_role(auth.uid(), 'client_admin'::app_role)
);

-- Update agent_priorities RLS
DROP POLICY IF EXISTS "Super admins manage all agent_priorities" ON agent_priorities;
DROP POLICY IF EXISTS "Client admins manage org agent_priorities" ON agent_priorities;
DROP POLICY IF EXISTS "Users view authorized agent_priorities" ON agent_priorities;

CREATE POLICY "Super admins manage org agent_priorities" 
ON agent_priorities FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating client admin manage agent_priorities" 
ON agent_priorities FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating agent view agent_priorities" 
ON agent_priorities FOR SELECT 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND organization_id = get_user_org(auth.uid())
    AND (org_uses_shared_access(organization_id) OR agent_id = auth.uid())
);

CREATE POLICY "Client admins manage org agent_priorities" 
ON agent_priorities FOR ALL 
USING (
    has_role(auth.uid(), 'client_admin'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Agents view authorized agent_priorities" 
ON agent_priorities FOR SELECT 
USING (
    has_role(auth.uid(), 'agent'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND NOT has_role(auth.uid(), 'client_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
    AND (org_uses_shared_access(organization_id) OR agent_id = auth.uid())
);

-- Update webhook_health RLS
DROP POLICY IF EXISTS "Super admins manage webhook_health" ON webhook_health;
DROP POLICY IF EXISTS "Client admins view org webhook_health" ON webhook_health;

CREATE POLICY "Super admins manage org webhook_health" 
ON webhook_health FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating client admin view webhook_health" 
ON webhook_health FOR SELECT 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Client admins view org webhook_health" 
ON webhook_health FOR SELECT 
USING (
    has_role(auth.uid(), 'client_admin'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
);

-- Update rubric_templates RLS
DROP POLICY IF EXISTS "Super admins manage all rubric_templates" ON rubric_templates;
DROP POLICY IF EXISTS "Client admins manage org rubric_templates" ON rubric_templates;
DROP POLICY IF EXISTS "Users view org rubric_templates" ON rubric_templates;

CREATE POLICY "Super admins manage org rubric_templates" 
ON rubric_templates FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating client admin manage rubric_templates" 
ON rubric_templates FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating agent view rubric_templates" 
ON rubric_templates FOR SELECT 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Client admins manage org rubric_templates" 
ON rubric_templates FOR ALL 
USING (
    has_role(auth.uid(), 'client_admin'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Org users view rubric_templates" 
ON rubric_templates FOR SELECT 
USING (
    organization_id = get_user_org(auth.uid())
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND NOT has_role(auth.uid(), 'client_admin'::app_role)
);