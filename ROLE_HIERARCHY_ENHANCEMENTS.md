# 🎯 Role Hierarchy Enhancement Recommendations
**Date:** January 17, 2026  
**Context:** Post-Security Audit Improvements  
**Current System:** 3-tier (super_admin, client_admin, agent)

---

## 📊 Current State Assessment

### ✅ Strengths
- **Separate `user_roles` table** prevents privilege escalation
- **PostgreSQL ENUM type** provides type safety
- **Impersonation system** allows super admins to test permissions
- **SECURITY DEFINER functions** prevent RLS recursion
- **Database-driven** (not hardcoded emails)

### ⚠️ Gaps Identified
1. **No granular permissions** within roles
2. **Limited role differentiation** (only 3 levels)
3. **No team/department hierarchy** within organizations
4. **Sub-role column exists but unused** (added in migration 20251210014930)
5. **Permission_sets table exists but not enforced** (from 20251212_enhanced_features.sql)
6. **No audit trail** for role changes
7. **No time-based role assignments** (temporary permissions)

---

## 🚀 Recommended Enhancements

### Priority 1: Activate Sub-Role System (HIGH IMPACT, LOW EFFORT)

**Current State:** Column exists but unused
```sql
-- Already in database from 20251210014930
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS sub_role TEXT;
```

**Implementation:** Activate sub-roles for agent specialization

```sql
-- Create sub-role ENUM for type safety
CREATE TYPE public.agent_sub_role AS ENUM (
  'sales',           -- Focused on lead conversion
  'support',         -- Customer service and support
  'operations',      -- Bookings and logistics
  'training',        -- Training and quality assurance
  'team_lead'        -- Manages other agents
);

-- Create client_admin sub-role ENUM
CREATE TYPE public.admin_sub_role AS ENUM (
  'operations',      -- Day-to-day operations
  'hr',              -- User management and training
  'finance',         -- Billing and financial data
  'it'               -- Technical settings and integrations
);

-- Update user_roles table to use sub_role with validation
ALTER TABLE user_roles 
  ADD CONSTRAINT valid_sub_role CHECK (
    (role = 'agent' AND sub_role::agent_sub_role IS NOT NULL) OR
    (role = 'client_admin' AND sub_role::admin_sub_role IS NOT NULL) OR
    (role = 'super_admin' AND sub_role IS NULL)
  );
```

**Benefits:**
- ✅ Better agent specialization tracking
- ✅ More granular reporting (e.g., "sales team performance")
- ✅ Foundation for permission differentiation
- ✅ Improved onboarding/training paths

**RLS Policy Example:**
```sql
-- Sales agents see all leads, support agents only assigned
CREATE POLICY "Sales agents view all org leads"
ON leads FOR SELECT
USING (
  has_role(auth.uid(), 'agent'::app_role) 
  AND organization_id = get_user_org(auth.uid())
  AND get_user_sub_role(auth.uid()) = 'sales'::agent_sub_role
);

CREATE POLICY "Support agents view assigned leads"
ON leads FOR SELECT
USING (
  has_role(auth.uid(), 'agent'::app_role) 
  AND organization_id = get_user_org(auth.uid())
  AND get_user_sub_role(auth.uid()) = 'support'::agent_sub_role
  AND assigned_agent_id = auth.uid()
);
```

---

### Priority 2: Implement Team/Department Hierarchy (MEDIUM IMPACT, MEDIUM EFFORT)

**Problem:** No way to group agents into teams within an organization

**Solution:** Add teams table with team leaders

```sql
-- Teams table (e.g., "Sales Team", "Support Team")
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  team_lead_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(organization_id, name)
);

-- Team memberships (many-to-many)
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member', -- 'member' or 'lead'
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(team_id, user_id)
);

-- Helper function to check team membership
CREATE OR REPLACE FUNCTION is_team_lead(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = _team_id 
    AND user_id = _user_id 
    AND role = 'lead'
  )
$$;
```

**Use Cases:**
- Team leads can view their team's performance
- Filter leads/bookings by team
- Assign leads to teams, not just individuals
- Team-based quotas and leaderboards

**RLS Policy Example:**
```sql
-- Team leads can view their team members' data
CREATE POLICY "Team leads view team leads"
ON leads FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM team_members tm
    JOIN team_members my_team ON my_team.team_id = tm.team_id
    WHERE my_team.user_id = auth.uid() 
    AND my_team.role = 'lead'
    AND tm.user_id = leads.assigned_agent_id
  )
);
```

---

### Priority 3: Activate Permission Sets (HIGH IMPACT, HIGH EFFORT)

**Current State:** Tables exist but not integrated with RLS
```sql
-- From 20251212_enhanced_features.sql
CREATE TABLE IF NOT EXISTS permission_sets (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL,
  ...
);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id UUID,
  permission_set_id UUID REFERENCES permission_sets(id),
  ...
);
```

**Implementation:** Bridge permission sets with RLS policies

```sql
-- Create granular permissions structure
CREATE TYPE public.permission_action AS ENUM (
  'create', 'read', 'update', 'delete', 'export', 'import'
);

CREATE TYPE public.resource_type AS ENUM (
  'leads', 'bookings', 'orders', 'profiles', 
  'reports', 'settings', 'billing', 'integrations'
);

-- Improved permission_sets structure
ALTER TABLE permission_sets 
  ALTER COLUMN permissions TYPE JSONB 
  SET DEFAULT '[]'::jsonb;

-- Example permission set
INSERT INTO permission_sets (id, name, description, permissions) VALUES (
  gen_random_uuid(),
  'Sales Agent - Standard',
  'Standard permissions for sales agents',
  '[
    {"resource": "leads", "actions": ["create", "read", "update"]},
    {"resource": "bookings", "actions": ["create", "read"]},
    {"resource": "orders", "actions": ["read"]},
    {"resource": "reports", "actions": ["read"]}
  ]'::jsonb
);

-- Function to check custom permissions
CREATE OR REPLACE FUNCTION has_permission(
  _user_id UUID,
  _resource resource_type,
  _action permission_action
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  user_perms JSONB;
BEGIN
  -- Get all permission sets for user
  SELECT jsonb_agg(ps.permissions)
  INTO user_perms
  FROM user_permissions up
  JOIN permission_sets ps ON ps.id = up.permission_set_id
  WHERE up.user_id = _user_id;

  -- Check if permission exists in any set
  RETURN EXISTS (
    SELECT 1
    FROM jsonb_array_elements(user_perms) AS perm
    WHERE perm->>'resource' = _resource::text
    AND perm->'actions' ? _action::text
  );
END;
$$;
```

**RLS Integration:**
```sql
-- Use custom permissions in RLS policies
CREATE POLICY "Custom permissions for leads"
ON leads FOR ALL
USING (
  -- Standard role check OR custom permission
  has_role(auth.uid(), 'client_admin'::app_role)
  OR has_permission(auth.uid(), 'leads'::resource_type, 'read'::permission_action)
);
```

**Benefits:**
- ✅ Custom permission sets per client organization
- ✅ No need to modify database for permission changes
- ✅ Flexible "contractor" or "limited admin" roles
- ✅ Compliance: Principle of least privilege

---

### Priority 4: Add Role Assignment Audit Trail (MEDIUM IMPACT, LOW EFFORT)

**Problem:** No visibility into who changed roles and when

**Solution:** Audit table for role changes

```sql
-- Role change audit table
CREATE TABLE public.user_role_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  old_role app_role,
  new_role app_role NOT NULL,
  old_sub_role TEXT,
  new_sub_role TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Trigger to log role changes
CREATE OR REPLACE FUNCTION log_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role != NEW.role THEN
    INSERT INTO user_role_audit (
      user_id, 
      changed_by, 
      old_role, 
      new_role, 
      old_sub_role, 
      new_sub_role
    ) VALUES (
      NEW.user_id,
      auth.uid(),
      OLD.role,
      NEW.role,
      OLD.sub_role,
      NEW.sub_role
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_user_role_changes
AFTER UPDATE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION log_role_change();
```

**Benefits:**
- ✅ Compliance requirement (SOC 2, GDPR)
- ✅ Security forensics (who granted super_admin?)
- ✅ Troubleshooting (when did agent become client_admin?)

---

### Priority 5: Time-Based Role Assignments (LOW IMPACT, MEDIUM EFFORT)

**Use Case:** Temporary elevated permissions (e.g., "agent becomes team_lead for 2 weeks")

**Solution:** Add expiration to user_roles

```sql
-- Add expiration column
ALTER TABLE user_roles 
  ADD COLUMN expires_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN granted_by UUID REFERENCES profiles(id);

-- Function to clean up expired roles (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_roles()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Log expirations before deleting
  INSERT INTO user_role_audit (user_id, changed_by, old_role, new_role, reason)
  SELECT 
    user_id,
    granted_by,
    role,
    NULL,
    'Role expired automatically'
  FROM user_roles
  WHERE expires_at IS NOT NULL 
  AND expires_at < now();

  -- Delete expired roles
  DELETE FROM user_roles
  WHERE expires_at IS NOT NULL 
  AND expires_at < now();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

-- Schedule via pg_cron (if available) or Edge Function
-- SELECT cron.schedule('cleanup-expired-roles', '0 * * * *', 'SELECT cleanup_expired_roles()');
```

**Benefits:**
- ✅ Temporary contractor access
- ✅ Trial periods for promotions
- ✅ Automated security (no manual revocation needed)

---

### Priority 6: Read-Only Role Variant (LOW IMPACT, LOW EFFORT)

**Use Case:** Auditors, data analysts, or executives who need visibility but no edit rights

**Solution:** Add `viewer` role

```sql
-- Extend app_role ENUM
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'viewer';

-- Or create a separate role level:
CREATE TYPE public.access_level AS ENUM (
  'read_only',
  'read_write',
  'full_access'
);

ALTER TABLE user_roles ADD COLUMN access_level access_level DEFAULT 'full_access';
```

**RLS Policy Example:**
```sql
-- Viewers can see data but not modify
CREATE POLICY "Viewers can read org data"
ON leads FOR SELECT
USING (
  has_role(auth.uid(), 'viewer'::app_role)
  AND organization_id = get_user_org(auth.uid())
);

-- Block all INSERT/UPDATE/DELETE for viewers
CREATE POLICY "Viewers cannot modify data"
ON leads FOR INSERT
WITH CHECK (NOT has_role(auth.uid(), 'viewer'::app_role));
```

**Benefits:**
- ✅ Safe dashboard access for stakeholders
- ✅ Audit compliance (separation of duties)
- ✅ Training environments

---

## 🎯 Implementation Roadmap

### Phase 1: Quick Wins (1-2 days)
1. ✅ **Activate sub-role system** (use existing column)
2. ✅ **Add role audit trail** (compliance requirement)
3. ✅ **Document current permission matrix** (update SECURITY.md)

### Phase 2: Foundation (1 week)
4. ✅ **Implement teams/departments** (agents grouped by team)
5. ✅ **Create team lead permissions** (view team performance)
6. ✅ **Add frontend UI** for sub-role selection

### Phase 3: Advanced (2-3 weeks)
7. ✅ **Activate permission_sets** (granular custom permissions)
8. ✅ **Integrate permission checks** in RLS policies
9. ✅ **Build admin UI** for permission management

### Phase 4: Optional Enhancements (future)
10. ⏰ **Time-based role assignments** (temporary permissions)
11. 👁️ **Read-only viewer role** (auditors/analysts)
12. 🔄 **Role approval workflow** (requires admin approval for promotions)

---

## 📋 Permission Matrix (Recommended)

| Role | Leads | Bookings | Orders | Reports | Users | Settings | Billing |
|------|-------|----------|--------|---------|-------|----------|---------|
| **super_admin** | Full | Full | Full | Full | Full | Full | Full |
| **client_admin** | Org | Org | Org | Org | Org | Org | Org |
| **agent (sales)** | All Org | Assigned | View | View | View Team | View | - |
| **agent (support)** | Assigned | Assigned | View | - | View Team | View | - |
| **agent (operations)** | View | All Org | All Org | View | View Team | View | - |
| **team_lead** | Team | Team | Team | Team | Team | - | - |
| **viewer** | View Org | View Org | View Org | View Org | - | - | - |

---

## 🔧 Helper Functions to Create

```sql
-- Get user's sub-role
CREATE OR REPLACE FUNCTION get_user_sub_role(_user_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT sub_role FROM user_roles 
  WHERE user_id = _user_id 
  LIMIT 1
$$;

-- Check if user is team lead
CREATE OR REPLACE FUNCTION is_team_lead(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id = _user_id AND role = 'lead'
  )
$$;

-- Get user's team members
CREATE OR REPLACE FUNCTION get_team_member_ids(_user_id UUID)
RETURNS UUID[]
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT ARRAY_AGG(DISTINCT tm.user_id)
  FROM team_members tm
  JOIN team_members my_teams ON my_teams.team_id = tm.team_id
  WHERE my_teams.user_id = _user_id
  AND my_teams.role = 'lead'
$$;
```

---

## 🚨 Security Considerations

### ⚠️ Don't Do This:
- ❌ Store permissions in frontend (always verify server-side)
- ❌ Allow role self-elevation (must be granted by higher role)
- ❌ Use sub_role for security decisions without role validation
- ❌ Bypass RLS by using service role in Edge Functions

### ✅ Do This:
- ✅ Validate role + sub_role combination in database constraints
- ✅ Audit all role changes with who/when/why
- ✅ Use SECURITY DEFINER carefully (set search_path)
- ✅ Test impersonation for each sub-role
- ✅ Document permission matrix in SECURITY.md

---

## 📝 Migration Example (Quick Start)

```sql
-- FILE: supabase/migrations/20260117_activate_sub_roles.sql

-- Step 1: Create sub-role ENUMs
CREATE TYPE public.agent_sub_role AS ENUM (
  'sales', 'support', 'operations', 'training', 'team_lead'
);

CREATE TYPE public.admin_sub_role AS ENUM (
  'operations', 'hr', 'finance', 'it'
);

-- Step 2: Create helper function
CREATE OR REPLACE FUNCTION get_user_sub_role(_user_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT sub_role FROM user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Step 3: Create role audit table
CREATE TABLE public.user_role_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  old_role app_role,
  new_role app_role NOT NULL,
  old_sub_role TEXT,
  new_sub_role TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_role_audit_user ON user_role_audit(user_id, created_at DESC);

-- Step 4: Create audit trigger
CREATE OR REPLACE FUNCTION log_role_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.role != NEW.role OR OLD.sub_role != NEW.sub_role) THEN
    INSERT INTO user_role_audit (
      user_id, changed_by, old_role, new_role, old_sub_role, new_sub_role
    ) VALUES (
      NEW.user_id, auth.uid(), OLD.role, NEW.role, OLD.sub_role, NEW.sub_role
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_user_role_changes
AFTER UPDATE ON user_roles
FOR EACH ROW EXECUTE FUNCTION log_role_change();

-- Step 5: Enable RLS on audit table
ALTER TABLE user_role_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins view role audit"
ON user_role_audit FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Step 6: Update frontend types
COMMENT ON COLUMN user_roles.sub_role IS 
'Agent sub-roles: sales, support, operations, training, team_lead. 
Admin sub-roles: operations, hr, finance, it.';
```

---

## 📚 Frontend Implementation

```typescript
// types/database.ts
export type AgentSubRole = 'sales' | 'support' | 'operations' | 'training' | 'team_lead';
export type AdminSubRole = 'operations' | 'hr' | 'finance' | 'it';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  sub_role: AgentSubRole | AdminSubRole | null;
}

// hooks/useUserRole.ts
export function useUserRole() {
  const { user } = useAuth();
  
  const { data: userRole } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role, sub_role')
        .eq('user_id', user?.id)
        .single();
      return data;
    },
  });

  return {
    role: userRole?.role,
    subRole: userRole?.sub_role,
    isSalesAgent: userRole?.role === 'agent' && userRole?.sub_role === 'sales',
    isSupportAgent: userRole?.role === 'agent' && userRole?.sub_role === 'support',
    isTeamLead: userRole?.sub_role === 'team_lead',
  };
}
```

---

## 🎓 Conclusion

Your current 3-tier role system is **solid and secure**, but these enhancements will provide:

1. **Better Specialization** - Sub-roles for agent types
2. **Team Management** - Group agents into teams with leads
3. **Flexibility** - Custom permission sets without code changes
4. **Compliance** - Audit trail for all role changes
5. **Scalability** - Support for complex organizational structures

**Recommended Next Steps:**
1. ✅ Review and prioritize enhancements
2. ✅ Implement Phase 1 (sub-roles + audit trail) immediately
3. ✅ Deploy security fixes first (from previous work)
4. ✅ Test sub-role system with impersonation
5. ✅ Update documentation (SECURITY.md)
