-- Fix ai_conversations - drop existing policies that conflict
DROP POLICY IF EXISTS "Client admins manage org ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Agents view authorized ai_conversations" ON ai_conversations;

CREATE POLICY "Client admins manage org ai_conversations" 
ON ai_conversations FOR ALL 
USING (
    has_role(auth.uid(), 'client_admin'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Agents view authorized ai_conversations" 
ON ai_conversations FOR SELECT 
USING (
    has_role(auth.uid(), 'agent'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND NOT has_role(auth.uid(), 'client_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
    AND (org_uses_shared_access(organization_id) OR is_assigned_to_lead(auth.uid(), lead_id))
);

-- Continue with knowledge_base tables
DROP POLICY IF EXISTS "Super admins manage org knowledge_base_entries" ON knowledge_base_entries;
DROP POLICY IF EXISTS "Impersonating client admin manage knowledge_base_entries" ON knowledge_base_entries;
DROP POLICY IF EXISTS "Impersonating agent view knowledge_base_entries" ON knowledge_base_entries;
DROP POLICY IF EXISTS "Client admins manage org knowledge_base_entries" ON knowledge_base_entries;
DROP POLICY IF EXISTS "Org users view knowledge_base_entries" ON knowledge_base_entries;
DROP POLICY IF EXISTS "Super admins manage all knowledge_base_entries" ON knowledge_base_entries;

CREATE POLICY "Super admins manage org knowledge_base_entries" 
ON knowledge_base_entries FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating client admin manage knowledge_base_entries" 
ON knowledge_base_entries FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating agent view knowledge_base_entries" 
ON knowledge_base_entries FOR SELECT 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Client admins manage org knowledge_base_entries" 
ON knowledge_base_entries FOR ALL 
USING (
    has_role(auth.uid(), 'client_admin'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Org users view knowledge_base_entries" 
ON knowledge_base_entries FOR SELECT 
USING (
    organization_id = get_user_org(auth.uid())
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND NOT has_role(auth.uid(), 'client_admin'::app_role)
);

-- Update knowledge_base_documents RLS
DROP POLICY IF EXISTS "Super admins manage all knowledge_base_documents" ON knowledge_base_documents;
DROP POLICY IF EXISTS "Super admins manage org knowledge_base_documents" ON knowledge_base_documents;
DROP POLICY IF EXISTS "Client admins manage org knowledge_base_documents" ON knowledge_base_documents;
DROP POLICY IF EXISTS "Org users view knowledge_base_documents" ON knowledge_base_documents;
DROP POLICY IF EXISTS "Impersonating client admin manage knowledge_base_documents" ON knowledge_base_documents;
DROP POLICY IF EXISTS "Impersonating agent view knowledge_base_documents" ON knowledge_base_documents;

CREATE POLICY "Super admins manage org knowledge_base_documents" 
ON knowledge_base_documents FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating client admin manage knowledge_base_documents" 
ON knowledge_base_documents FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating agent view knowledge_base_documents" 
ON knowledge_base_documents FOR SELECT 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Client admins manage org knowledge_base_documents" 
ON knowledge_base_documents FOR ALL 
USING (
    has_role(auth.uid(), 'client_admin'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Org users view knowledge_base_documents" 
ON knowledge_base_documents FOR SELECT 
USING (
    organization_id = get_user_org(auth.uid())
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND NOT has_role(auth.uid(), 'client_admin'::app_role)
);