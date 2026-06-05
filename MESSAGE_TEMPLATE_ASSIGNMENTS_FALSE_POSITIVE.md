# Security Issue: message_template_assignments Table

**Date:** January 21, 2026  
**Issue:** Lint/advisor tool reports missing RLS policies for `message_template_assignments`  
**Status:** 🚨 **CONFIRMED - ORPHANED TABLE WITH NO RLS**

---

## Summary

The lint item is **VALID**. The table `public.message_template_assignments` exists in the database but:
- ❌ **Has NO RLS enabled** (security vulnerability)
- ❌ **No code usage** (not referenced in TypeScript/React)
- ❌ **No migration file** (created outside version control)
- ✅ **Ready to drop** (orphaned table from abandoned feature)

---

## Investigation Results

### 🚨 CONFIRMED: Orphaned Table Exists

**Database Inspection:**
```sql
-- Table structure
Relation: public.message_template_assignments (base table)
Columns:
  - template_id (uuid, PK part)
  - user_id (uuid, PK part)
  - created_at (timestamptz, default now())

Constraints:
  - PK: (template_id, user_id)
  - FK: template_id → public.message_templates(id) ON DELETE CASCADE
  - FK: user_id → auth.users(id) ON DELETE CASCADE

Indexes:
  - message_template_assignments_pkey on (template_id, user_id)
  - idx_message_template_assignments_user on (user_id, template_id)

RLS: DISABLED (relrowsecurity = false) ⚠️ SECURITY RISK
```

**Code Search Results:**
- ❌ **No TypeScript/React code** using this table
- ❌ **No migration file** creating this table
- ❌ **No hooks or queries** referencing it
- ✅ **Table exists in database only** (orphaned)

**Evidence:**
```bash
# Code search - NO matches
grep -r "message_template_assignment" src/
# Result: 0 matches

# Migration search - NO matches
grep -r "message_template_assignment" supabase/migrations/
# Result: 0 matches

# Database verification - EXISTS
\d public.message_template_assignments
# Result: Table found with structure above
```

---

## ✅ Actual Table: message_templates

**Location:** [supabase/migrations/20251212205506_3730a502-ddb9-4fe7-8eff-317fc3482278.sql](supabase/migrations/20251212205506_3730a502-ddb9-4fe7-8eff-317fc3482278.sql#L44-L57)

### Schema

```sql
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject TEXT,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### Access Model: **Organization-Based (Tenant-Scoped)**

- **NOT ownership-based** (no user_id controls access)
- **Tenant-scoped:** All users in an organization share templates
- **Column:** `organization_id` enforces tenant isolation

### RLS Policies ✅ Properly Configured

**Policy 1: View Access** (Lines 153-155)
```sql
CREATE POLICY "Users can view message templates in their organization" 
ON public.message_templates
FOR SELECT 
USING (organization_id = get_user_org(auth.uid()));
```

**Policy 2: Client Admin Management** (Lines 157-159)
```sql
CREATE POLICY "Client admins manage org message templates" 
ON public.message_templates
FOR ALL 
USING (
  has_role(auth.uid(), 'client_admin') AND 
  organization_id = get_user_org(auth.uid())
);
```

**Policy 3: Super Admin Access** (Lines 161-163)
```sql
CREATE POLICY "Super admins manage all message templates" 
ON public.message_templates
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'));
```

---

## Root Cause Analysis

### Why This Table Exists

**Most Likely:** Created manually via Supabase dashboard or direct psql command during exploration/testing.

**Evidence:**
1. No migration file in `supabase/migrations/`
2. No code references in application
3. Proper foreign keys suggest intentional creation (not accidental)
4. Similar structure to join table pattern

**Original Intent (Speculation):**
- Intended to assign specific templates to specific users
- Would enable per-user template visibility/access
- Abandoned in favor of simpler org-wide template sharing via `message_templates`

### Security Risk

**CRITICAL:** Table has **NO RLS policies**, meaning:
- ✅ Anyone with database access can read/write
- ✅ If accessed via client code (not currently), data would leak across organizations
- ✅ Super admins can't be scoped to their org (if this were implemented)

**Current Risk Level:** 🟡 **MEDIUM**
- Low immediate risk since no code uses it
- High risk if someone adds code without enabling RLS first

---

## Resolution Actions

### ✅ RECOMMENDED: Drop the Orphaned Table

**Migration Created:** [supabase/migrations/20260121000000_drop_message_template_assignments.sql](supabase/migrations/20260121000000_drop_message_template_assignments.sql)

**What It Does:**
1. Verifies table exists
2. Checks RLS status
3. Counts existing rows (warns if data present)
4. Drops table with CASCADE (removes indexes/constraints)
5. Verifies successful removal

**To Execute:**
```bash
# Review the migration first
cat supabase/migrations/20260121000000_drop_message_template_assignments.sql

# Apply migration
supabase db push

# Or if linked to remote
supabase db push --linked

# Verify table is gone
psql "$DATABASE_URL" -c "\d public.message_template_assignments"
# Expected: "Did not find any relation"
```

### Alternative Options (Not Recommended)

#### Option 1: Secure with RLS (If keeping table)
Only do this if you plan to implement user-specific template assignments:

```sql
-- Enable RLS
ALTER TABLE public.message_template_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Users view their own assignments
CREATE POLICY "Users view own template assignments"
ON public.message_template_assignments FOR SELECT
USING (user_id = auth.uid());

-- Policy: Admins manage assignments in their org
CREATE POLICY "Admins manage org template assignments"
ON public.message_template_assignments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.message_templates mt
    WHERE mt.id = template_id
    AND mt.organization_id = get_user_org(auth.uid())
    AND (
      has_role(auth.uid(), 'client_admin'::app_role) OR
      has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
);
```

#### Option 2: Lockdown Temporarily
If unsure, temporarily block all access:

```sql
ALTER TABLE public.message_template_assignments ENABLE ROW LEVEL SECURITY;
-- No policies = deny all access
```

---

## If Join Table Is Actually Needed (Future Enhancement)

If you need to assign specific templates to specific users/teams (instead of org-wide sharing):

### Proposed Schema

```sql
CREATE TABLE IF NOT EXISTS public.message_template_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.message_templates(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to_role app_role,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(template_id, assigned_to_user_id)
);

-- RLS Policies
ALTER TABLE public.message_template_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their org's template assignments"
ON public.message_template_assignments FOR SELECT
USING (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Admins manage template assignments"
ON public.message_template_assignments FOR ALL
USING (
  has_role(auth.uid(), 'client_admin') AND 
  organization_id = get_user_org(auth.uid())
);
```

**Note:** This is **not currently needed** based on requirements.

---

## References

- [message_templates migration](supabase/migrations/20251212205506_3730a502-ddb9-4fe7-8eff-317fc3482278.sql)
- [Verification script](scripts/verify-message-templates-table.sql)
- [Security audit report](SECURITY_AUDIT_REPORT_JAN2026.md)
- [Database types](src/types/database.ts)

---

## Contact

For questions about this false positive, contact the database team or review the verification script output.
