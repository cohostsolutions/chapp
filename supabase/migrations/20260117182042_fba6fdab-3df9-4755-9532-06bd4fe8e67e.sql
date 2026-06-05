
-- ============================================
-- ROLE HIERARCHY ENHANCEMENTS MIGRATION
-- Implements all 6 priorities from ROLE_HIERARCHY_ENHANCEMENTS.md
-- ============================================

-- Priority 6: Add 'viewer' role to app_role ENUM (must be done first)
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'viewer';

-- Priority 1: Create Sub-Role ENUMs
DO $$ BEGIN
  CREATE TYPE public.agent_sub_role AS ENUM (
  'sales',           -- Focused on lead conversion
  'support',         -- Customer service and support
  'operations',      -- Bookings and logistics
  'training',        -- Training and quality assurance
  'team_lead'        -- Manages other agents
);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.admin_sub_role AS ENUM (
  'operations',      -- Day-to-day operations
  'hr',              -- User management and training
  'finance',         -- Billing and financial data
  'it'               -- Technical settings and integrations
);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Priority 5: Add time-based role columns to user_roles
ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Priority 1: Helper function to get user's sub-role
CREATE OR REPLACE FUNCTION public.get_user_sub_role(_user_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sub_role FROM user_roles 
  WHERE user_id = _user_id 
  LIMIT 1
$$;

-- Priority 2: Create Teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  team_lead_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(organization_id, name)
);

-- Priority 2: Create Team Members table (many-to-many)
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'lead')),
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(team_id, user_id)
);

-- Priority 2: Helper function to check if user is team lead
CREATE OR REPLACE FUNCTION public.is_team_lead(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id = _user_id AND role = 'lead'
  )
$$;

-- Priority 2: Helper function to check if user is lead of specific team
CREATE OR REPLACE FUNCTION public.is_team_lead(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = _team_id 
    AND user_id = _user_id 
    AND role = 'lead'
  )
$$;

-- Priority 2: Helper function to get user's team member IDs
CREATE OR REPLACE FUNCTION public.get_team_member_ids(_user_id UUID)
RETURNS UUID[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(DISTINCT tm.user_id), ARRAY[]::UUID[])
  FROM team_members tm
  JOIN team_members my_teams ON my_teams.team_id = tm.team_id
  WHERE my_teams.user_id = _user_id
  AND my_teams.role = 'lead'
$$;

-- Priority 3: Create Permission Sets table
CREATE TABLE IF NOT EXISTS public.permission_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN DEFAULT false, -- System sets can't be deleted
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Priority 3: Create User Permissions table (links users to permission sets)
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  permission_set_id UUID REFERENCES public.permission_sets(id) ON DELETE CASCADE NOT NULL,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, permission_set_id)
);

-- Priority 3: Create ENUMs for permission types
DO $$ BEGIN
  CREATE TYPE public.permission_action AS ENUM (
  'create', 'read', 'update', 'delete', 'export', 'import', 'manage'
);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.resource_type AS ENUM (
  'leads', 'bookings', 'orders', 'profiles', 
  'reports', 'settings', 'billing', 'integrations',
  'teams', 'users', 'communications'
);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Priority 3: Helper function to check custom permissions
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id UUID,
  _resource TEXT,
  _action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_perm BOOLEAN := false;
BEGIN
  -- Check if permission exists in any of user's permission sets
  SELECT EXISTS (
    SELECT 1
    FROM user_permissions up
    JOIN permission_sets ps ON ps.id = up.permission_set_id
    WHERE up.user_id = _user_id
    AND ps.permissions @> jsonb_build_array(
      jsonb_build_object('resource', _resource, 'actions', jsonb_build_array(_action))
    )
  ) OR EXISTS (
    SELECT 1
    FROM user_permissions up
    JOIN permission_sets ps ON ps.id = up.permission_set_id,
    jsonb_array_elements(ps.permissions) AS perm
    WHERE up.user_id = _user_id
    AND perm->>'resource' = _resource
    AND perm->'actions' ? _action
  ) INTO has_perm;
  
  RETURN has_perm;
END;
$$;

-- Priority 4: Create Role Assignment Audit Trail table
CREATE TABLE IF NOT EXISTS public.user_role_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- Don't cascade delete - keep history
  changed_by UUID, -- Who made the change
  old_role app_role,
  new_role app_role,
  old_sub_role TEXT,
  new_sub_role TEXT,
  action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Priority 4: Trigger function to log role changes
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO user_role_audit (user_id, changed_by, old_role, new_role, old_sub_role, new_sub_role, action)
    VALUES (NEW.user_id, auth.uid(), NULL, NEW.role, NULL, NEW.sub_role, 'insert');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log if role or sub_role actually changed
    IF OLD.role IS DISTINCT FROM NEW.role OR OLD.sub_role IS DISTINCT FROM NEW.sub_role THEN
      INSERT INTO user_role_audit (user_id, changed_by, old_role, new_role, old_sub_role, new_sub_role, action)
      VALUES (NEW.user_id, auth.uid(), OLD.role, NEW.role, OLD.sub_role, NEW.sub_role, 'update');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO user_role_audit (user_id, changed_by, old_role, new_role, old_sub_role, new_sub_role, action)
    VALUES (OLD.user_id, auth.uid(), OLD.role, NULL, OLD.sub_role, NULL, 'delete');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Priority 4: Create trigger on user_roles
DROP TRIGGER IF EXISTS audit_user_role_changes ON public.user_roles;
CREATE TRIGGER audit_user_role_changes
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.log_role_change();

-- Priority 5: Function to clean up expired roles
CREATE OR REPLACE FUNCTION public.cleanup_expired_roles()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Delete expired roles (trigger will log to audit)
  DELETE FROM user_roles
  WHERE expires_at IS NOT NULL 
  AND expires_at < now();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS on new tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_audit ENABLE ROW LEVEL SECURITY;

-- Teams: Super admins see all, client admins see their org, agents see their teams
CREATE POLICY "Super admins can manage all teams"
ON public.teams FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Client admins can manage org teams"
ON public.teams FOR ALL
USING (
  public.has_role(auth.uid(), 'client_admin'::app_role)
  AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Agents can view their org teams"
ON public.teams FOR SELECT
USING (
  public.has_role(auth.uid(), 'agent'::app_role)
  AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

-- Team Members: Similar hierarchy
CREATE POLICY "Super admins can manage all team members"
ON public.team_members FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Client admins can manage org team members"
ON public.team_members FOR ALL
USING (
  public.has_role(auth.uid(), 'client_admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM teams t 
    WHERE t.id = team_members.team_id 
    AND t.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Team leads can view their team members"
ON public.team_members FOR SELECT
USING (
  public.is_team_lead(auth.uid(), team_id)
);

CREATE POLICY "Agents can view their own membership"
ON public.team_members FOR SELECT
USING (user_id = auth.uid());

-- Permission Sets: Only super admins can manage, all authenticated can view
CREATE POLICY "Super admins can manage permission sets"
ON public.permission_sets FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "All authenticated can view permission sets"
ON public.permission_sets FOR SELECT
USING (auth.uid() IS NOT NULL);

-- User Permissions: Super admins manage all, client admins manage org
CREATE POLICY "Super admins can manage all user permissions"
ON public.user_permissions FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Client admins can manage org user permissions"
ON public.user_permissions FOR ALL
USING (
  public.has_role(auth.uid(), 'client_admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = user_permissions.user_id 
    AND p.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Users can view their own permissions"
ON public.user_permissions FOR SELECT
USING (user_id = auth.uid());

-- Role Audit: Super admins see all, client admins see org, users see own
CREATE POLICY "Super admins can view all role audit"
ON public.user_role_audit FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Client admins can view org role audit"
ON public.user_role_audit FOR SELECT
USING (
  public.has_role(auth.uid(), 'client_admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = user_role_audit.user_id 
    AND p.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
);

CREATE POLICY "Users can view their own role history"
ON public.user_role_audit FOR SELECT
USING (user_id = auth.uid());

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_teams_organization ON public.teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_lead ON public.teams(team_lead_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON public.team_members(role);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_set ON public.user_permissions(permission_set_id);
CREATE INDEX IF NOT EXISTS idx_user_role_audit_user ON public.user_role_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_audit_created ON public.user_role_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_expires ON public.user_roles(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE TRIGGER update_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_permission_sets_updated_at
BEFORE UPDATE ON public.permission_sets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
