-- Fix ai_conversations RLS: super admins should only access their own org unless impersonating

-- Drop existing super admin policies
DROP POLICY IF EXISTS "Super admins manage all ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users view authorized ai_conversations" ON ai_conversations;

-- Super admins NOT impersonating: only their own org
CREATE POLICY "Super admins manage org ai_conversations" 
ON ai_conversations 
FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

-- Super admins impersonating as client_admin: same as client_admin access
CREATE POLICY "Impersonating client admin manage ai_conversations" 
ON ai_conversations 
FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND organization_id = get_user_org(auth.uid())
);

-- Super admins impersonating as agent: limited access like agents
CREATE POLICY "Impersonating agent view ai_conversations" 
ON ai_conversations 
FOR SELECT 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND organization_id = get_user_org(auth.uid())
    AND (org_uses_shared_access(organization_id) OR is_assigned_to_lead(auth.uid(), lead_id))
);