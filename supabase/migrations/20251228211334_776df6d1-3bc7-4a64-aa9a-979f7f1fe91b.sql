-- Update bookings RLS to respect impersonation
DROP POLICY IF EXISTS "Admins manage bookings" ON bookings;
DROP POLICY IF EXISTS "Users view authorized bookings" ON bookings;
DROP POLICY IF EXISTS "Agents manage authorized bookings" ON bookings;

-- Super admins NOT impersonating: own org only
CREATE POLICY "Super admins manage org bookings" 
ON bookings FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

-- Impersonating as client_admin
CREATE POLICY "Impersonating client admin manage bookings" 
ON bookings FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND organization_id = get_user_org(auth.uid())
);

-- Impersonating as agent
CREATE POLICY "Impersonating agent view bookings" 
ON bookings FOR SELECT 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND organization_id = get_user_org(auth.uid())
    AND (org_uses_shared_access(organization_id) OR is_assigned_to_lead(auth.uid(), lead_id))
);

CREATE POLICY "Impersonating agent manage bookings" 
ON bookings FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND organization_id = get_user_org(auth.uid())
    AND (org_uses_shared_access(organization_id) OR is_assigned_to_lead(auth.uid(), lead_id))
);

-- Client admins (non-super)
CREATE POLICY "Client admins manage org bookings" 
ON bookings FOR ALL 
USING (
    has_role(auth.uid(), 'client_admin'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
);

-- Agents (non-super, non-client_admin)
CREATE POLICY "Agents manage authorized bookings" 
ON bookings FOR ALL 
USING (
    has_role(auth.uid(), 'agent'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND NOT has_role(auth.uid(), 'client_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
    AND (org_uses_shared_access(organization_id) OR is_assigned_to_lead(auth.uid(), lead_id))
);

-- Update orders RLS
DROP POLICY IF EXISTS "Super admins manage all orders" ON orders;
DROP POLICY IF EXISTS "Client admins manage org orders" ON orders;
DROP POLICY IF EXISTS "Agents manage authorized orders" ON orders;
DROP POLICY IF EXISTS "Users view authorized orders" ON orders;

CREATE POLICY "Super admins manage org orders" 
ON orders FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating client admin manage orders" 
ON orders FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Impersonating agent manage orders" 
ON orders FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND organization_id = get_user_org(auth.uid())
    AND (org_uses_shared_access(organization_id) OR is_assigned_to_lead(auth.uid(), lead_id))
);

CREATE POLICY "Client admins manage org orders" 
ON orders FOR ALL 
USING (
    has_role(auth.uid(), 'client_admin'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Agents manage authorized orders" 
ON orders FOR ALL 
USING (
    has_role(auth.uid(), 'agent'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND NOT has_role(auth.uid(), 'client_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
    AND (org_uses_shared_access(organization_id) OR is_assigned_to_lead(auth.uid(), lead_id))
);