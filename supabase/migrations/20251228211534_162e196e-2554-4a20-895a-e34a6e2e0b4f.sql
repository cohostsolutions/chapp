-- Update reports RLS
DROP POLICY IF EXISTS "Super admins manage all reports" ON reports;
DROP POLICY IF EXISTS "Client admins manage org reports" ON reports;
DROP POLICY IF EXISTS "Users can view reports in their organization" ON reports;

CREATE POLICY "Super admins manage org reports" 
ON reports FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating client admin manage reports" 
ON reports FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating agent view reports" 
ON reports FOR SELECT 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Client admins manage org reports" 
ON reports FOR ALL 
USING (
    has_role(auth.uid(), 'client_admin'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Org users view reports" 
ON reports FOR SELECT 
USING (
    organization_id = get_user_org(auth.uid())
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND NOT has_role(auth.uid(), 'client_admin'::app_role)
);

-- Update offerings RLS
DROP POLICY IF EXISTS "Users can create offerings in their organization" ON offerings;
DROP POLICY IF EXISTS "Users can delete offerings in their organization" ON offerings;
DROP POLICY IF EXISTS "Users can update offerings in their organization" ON offerings;
DROP POLICY IF EXISTS "Users can view offerings in their organization" ON offerings;

CREATE POLICY "Super admins manage org offerings" 
ON offerings FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating users manage offerings" 
ON offerings FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Org users manage offerings" 
ON offerings FOR ALL 
USING (
    NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
);

-- Update room_units RLS (if exists)
DROP POLICY IF EXISTS "Super admins manage all room_units" ON room_units;
DROP POLICY IF EXISTS "Client admins manage org room_units" ON room_units;
DROP POLICY IF EXISTS "Org users view room_units" ON room_units;

CREATE POLICY "Super admins manage org room_units" 
ON room_units FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating users manage room_units" 
ON room_units FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Org users manage room_units" 
ON room_units FOR ALL 
USING (
    NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
);

-- Update social_platforms RLS
DROP POLICY IF EXISTS "Super admins manage all social_platforms" ON social_platforms;
DROP POLICY IF EXISTS "Client admins manage org social_platforms" ON social_platforms;
DROP POLICY IF EXISTS "Org users view social_platforms" ON social_platforms;

CREATE POLICY "Super admins manage org social_platforms" 
ON social_platforms FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating client admin manage social_platforms" 
ON social_platforms FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Client admins manage org social_platforms" 
ON social_platforms FOR ALL 
USING (
    has_role(auth.uid(), 'client_admin'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Org users view social_platforms" 
ON social_platforms FOR SELECT 
USING (
    organization_id = get_user_org(auth.uid())
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND NOT has_role(auth.uid(), 'client_admin'::app_role)
);

-- Update message_templates RLS
DROP POLICY IF EXISTS "Super admins manage all message templates" ON message_templates;
DROP POLICY IF EXISTS "Client admins manage org message templates" ON message_templates;
DROP POLICY IF EXISTS "Users can view message templates in their organization" ON message_templates;

CREATE POLICY "Super admins manage org message_templates" 
ON message_templates FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating client admin manage message_templates" 
ON message_templates FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating agent view message_templates" 
ON message_templates FOR SELECT 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Client admins manage org message_templates" 
ON message_templates FOR ALL 
USING (
    has_role(auth.uid(), 'client_admin'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Org users view message_templates" 
ON message_templates FOR SELECT 
USING (
    organization_id = get_user_org(auth.uid())
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND NOT has_role(auth.uid(), 'client_admin'::app_role)
);