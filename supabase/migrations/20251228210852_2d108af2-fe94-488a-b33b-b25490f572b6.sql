-- Add impersonated_role column to profiles for super admin role switching
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS impersonated_role app_role DEFAULT NULL;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Create a helper function to get the effective role (impersonated or actual)
CREATE OR REPLACE FUNCTION public.get_effective_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      -- If user has impersonated_role set, use that
      WHEN (SELECT impersonated_role FROM profiles WHERE id = _user_id) IS NOT NULL 
      THEN (SELECT impersonated_role FROM profiles WHERE id = _user_id)
      -- Otherwise, get their actual highest role
      WHEN has_role(_user_id, 'super_admin') THEN 'super_admin'::app_role
      WHEN has_role(_user_id, 'client_admin') THEN 'client_admin'::app_role
      ELSE 'agent'::app_role
    END
$$;

-- Create a function to check if currently impersonating
CREATE OR REPLACE FUNCTION public.is_impersonating(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = _user_id 
    AND impersonated_role IS NOT NULL
  )
$$;

-- Update profiles RLS: When impersonating, super admins should only see their current org's profiles
DROP POLICY IF EXISTS "Super admins view all profiles" ON profiles;
DROP POLICY IF EXISTS "Client admins view org profiles" ON profiles;
DROP POLICY IF EXISTS "Users view own profile" ON profiles;

-- Super admins NOT impersonating can see all profiles
CREATE POLICY "Super admins view all profiles" 
ON profiles 
FOR SELECT 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
);

-- When impersonating as client_admin, see only org profiles
CREATE POLICY "Impersonating client admin view org profiles" 
ON profiles 
FOR SELECT 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND organization_id = get_user_org(auth.uid())
);

-- When impersonating as agent, see only own profile
CREATE POLICY "Impersonating agent view own profile" 
ON profiles 
FOR SELECT 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND id = auth.uid()
);

-- Regular client admins view org profiles
CREATE POLICY "Client admins view org profiles" 
ON profiles 
FOR SELECT 
USING (
    has_role(auth.uid(), 'client_admin'::app_role) 
    AND NOT has_role(auth.uid(), 'super_admin'::app_role)
    AND organization_id = get_user_org(auth.uid())
);

-- Users can always view their own profile
CREATE POLICY "Users view own profile" 
ON profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Update leads RLS to respect impersonation
DROP POLICY IF EXISTS "Super admins view org leads" ON leads;
DROP POLICY IF EXISTS "Super admins manage org leads" ON leads;

-- Super admins NOT impersonating: full access to their org's leads
CREATE POLICY "Super admins view org leads" 
ON leads 
FOR SELECT 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Super admins manage org leads" 
ON leads 
FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND NOT is_impersonating(auth.uid())
    AND organization_id = get_user_org(auth.uid())
);

-- Super admins impersonating as client_admin: same as client_admin
CREATE POLICY "Impersonating client admin manage leads" 
ON leads 
FOR ALL 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'client_admin'::app_role
    AND organization_id = get_user_org(auth.uid())
);

-- Super admins impersonating as agent: limited access like agents
CREATE POLICY "Impersonating agent view leads" 
ON leads 
FOR SELECT 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND organization_id = get_user_org(auth.uid())
    AND (org_uses_shared_access(organization_id) OR assigned_agent_id = auth.uid())
);

CREATE POLICY "Impersonating agent update leads" 
ON leads 
FOR UPDATE 
USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    AND is_impersonating(auth.uid())
    AND get_effective_role(auth.uid()) = 'agent'::app_role
    AND organization_id = get_user_org(auth.uid())
    AND (org_uses_shared_access(organization_id) OR assigned_agent_id = auth.uid())
);