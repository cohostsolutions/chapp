-- Fix ai_messages: restrict super admins to own org
DROP POLICY IF EXISTS "Super admins manage all ai_messages" ON ai_messages;
CREATE POLICY "Super admins manage org ai_messages" 
ON ai_messages 
FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND EXISTS (
        SELECT 1 FROM ai_conversations c 
        WHERE c.id = ai_messages.conversation_id 
        AND c.organization_id = get_user_org(auth.uid())
    )
);

CREATE POLICY "Impersonating client admin manage ai_messages" 
ON ai_messages 
FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND EXISTS (
        SELECT 1 FROM ai_conversations c 
        WHERE c.id = ai_messages.conversation_id 
        AND c.organization_id = get_user_org(auth.uid())
    )
);

CREATE POLICY "Impersonating agent view ai_messages" 
ON ai_messages 
FOR SELECT 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND EXISTS (
        SELECT 1 FROM ai_conversations c 
        WHERE c.id = ai_messages.conversation_id 
        AND c.organization_id = get_user_org(auth.uid())
        AND (org_uses_shared_access(c.organization_id) OR is_assigned_to_lead(auth.uid(), c.lead_id))
    )
);

-- Fix workflows: restrict super admins to own org
DROP POLICY IF EXISTS "Super admins manage all workflows" ON workflows;
CREATE POLICY "Super admins manage org workflows" 
ON workflows 
FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating client admin manage workflows" 
ON workflows 
FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating agent view workflows" 
ON workflows 
FOR SELECT 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND organization_id = get_user_org(auth.uid())
);

-- Fix calendar_sync_events: restrict super admins to own org
DROP POLICY IF EXISTS "Super admins manage calendar_sync_events" ON calendar_sync_events;
CREATE POLICY "Super admins manage org calendar_sync_events" 
ON calendar_sync_events 
FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating client admin manage calendar_sync_events" 
ON calendar_sync_events 
FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND organization_id = get_user_org(auth.uid())
);

-- analytics_events is public tracking, keep super admin view access but no cross-org issue since it has no org_id

-- Fix leads: remove the migrate all policy and add org-restricted policy for normal use
-- Keep migrate policy but add org-restricted policy for normal viewing
DROP POLICY IF EXISTS "Super admins migrate all leads" ON leads;

-- For normal super admin access (own org only)
CREATE POLICY "Super admins manage org leads" 
ON leads 
FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

-- Fix social_platforms: same pattern
DROP POLICY IF EXISTS "Super admins migrate all social_platforms" ON social_platforms;

CREATE POLICY "Super admins manage org social_platforms" 
ON social_platforms 
FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);