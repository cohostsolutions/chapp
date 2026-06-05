# AI Training Access Troubleshooting Guide

## Problem: "Something Went Wrong" Error When Accessing AI Training

If users see errors when trying to access the AI Training feature, follow this troubleshooting guide.

## Root Causes & Solutions

### 1. **Organization Not Enabled for Training**
**Symptom:** Access is blocked with message "Training is not enabled for this organization"

**Cause:** The `training_enabled` flag is `false` or `null` in the organizations table

**Solution:**
```sql
-- As super admin, enable training for an organization
UPDATE organizations
SET training_enabled = true
WHERE id = 'YOUR_ORG_ID';
```

---

### 2. **RLS Policy Conflicts (Most Common)**
**Symptom:** Error appears in console, "something went wrong" message shows

**Root Cause:** Multiple conflicting RLS policies exist on training tables due to previous migrations

**Symptom Indicators:**
- Console shows: `permission denied for schema public`
- Different error messages for super admin vs client admin
- Works when impersonation is OFF but fails when impersonating

**Solution:**

Run the consolidation migration:
```bash
bun run db:push
```

This applies the unified RLS policies from:
- `20251231_consolidate_training_rls.sql`

The consolidated policies:
- ✅ Drop ALL conflicting policies
- ✅ Use `get_effective_role()` for proper impersonation
- ✅ Check `training_enabled` flag
- ✅ Allow super admins not impersonating to access

---

### 3. **Missing or Mismatched User Roles**
**Symptom:** Client admin or super admin can't manage modules

**Cause:** User role not properly set in `user_roles` table

**Solution:**
```sql
-- Check user roles
SELECT ur.user_id, ur.role, p.full_name, p.organization_id
FROM user_roles ur
JOIN profiles p ON p.id = ur.user_id
WHERE p.organization_id = 'YOUR_ORG_ID';

-- If missing, add role for user
INSERT INTO user_roles (user_id, role)
VALUES ('USER_ID', 'client_admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;
```

---

### 4. **Super Admin Impersonation Not Working**
**Symptom:** Super admin can access training normally, but can't manage modules when impersonating as client_admin

**Cause:** Old RLS policies used `user_role_view` which ignored impersonation

**Solution:**
Already fixed in `20251231_consolidate_training_rls.sql` - this migration uses `get_effective_role()` which respects the `impersonated_role` JWT claim.

Verify the fix is applied:
```bash
bun run db:push
```

---

### 5. **Database Migrations Not Applied**
**Symptom:** RLS policies reference functions that don't exist

**Cause:** Migrations not pushed to Supabase

**Solution:**
```bash
# Push all pending migrations
bun run db:push

# OR manually run via Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Run migrations in order:
#    - 20241226120000_training.sql
#    - 20251230_fix_training_impersonation.sql
#    - 20251230_enforce_training_access_control.sql
#    - 20251231_consolidate_training_rls.sql
```

---

## Debugging Steps

### Step 1: Check Browser Console
Open DevTools (F12) and look for:
- "Error fetching organization training settings"
- "RLS Error" messages
- Permission denied errors

### Step 2: Verify Organization Configuration
```sql
SELECT id, training_enabled, training_pii_redaction, training_retention_days
FROM organizations
WHERE id = 'ORG_ID';
```

Expected output: `training_enabled = true`

### Step 3: Verify User Roles
```sql
SELECT ur.user_id, ur.role, p.full_name
FROM user_roles ur
JOIN profiles p ON p.id = ur.user_id
WHERE ur.user_id = 'USER_ID';
```

Expected roles for managers:
- `client_admin` - Can create/edit modules
- `super_admin` - Can manage all orgs

### Step 4: Test RLS Policies
```sql
-- Check if user can select modules
SELECT COUNT(*) FROM training_modules
WHERE organization_id = 'ORG_ID';
-- Should return ≥ 0 (permission granted) or error (permission denied)
```

### Step 5: Check Database Logs
In Supabase Dashboard:
- Go to Logs → Edge Functions
- Look for errors in the past 5 minutes
- Check for "permission denied" or "row level security" messages

---

## Prevention Checklist

✅ **Before deploying training features:**
1. Run all migrations: `bun run db:push`
2. Enable training for test org: `UPDATE organizations SET training_enabled = true WHERE id = '...';`
3. Assign client_admin role to test user
4. Test as super admin NOT impersonating
5. Test as super admin impersonating as client_admin
6. Test as client admin directly

✅ **During user onboarding:**
1. Enable training_enabled for organization
2. Assign appropriate roles (client_admin, agent)
3. Test access before rolling out to users

✅ **For new organizations:**
```sql
UPDATE organizations
SET training_enabled = true
WHERE id = 'NEW_ORG_ID';
```

---

## Common Error Messages & Fixes

| Error Message | Cause | Fix |
|---|---|---|
| "Training is not enabled for this organization" | `training_enabled = false` | Enable via SQL or contact super admin |
| "permission denied for schema public" | RLS policy conflict | Run `bun run db:push` |
| "Something went wrong" | Generic RLS/permission error | Check browser console for details |
| "Failed to load training modules" | Database query error | Check Supabase logs, verify RLS policies |

---

## Contact & Support

If issues persist after following these steps:

1. **Check migrations are applied:**
   ```bash
   bun run db:push
   ```

2. **Review Supabase logs:** Dashboard → Logs → Edge Functions

3. **Verify RLS policies exist:**
   ```sql
   SELECT tablename, policyname
   FROM pg_policies
   WHERE tablename IN ('training_modules', 'training_sessions', 'rubric_templates')
   ORDER BY tablename, policyname;
   ```

4. **Expected policies** (after consolidation migration):
   - `training_modules_select`
   - `training_modules_manage`
   - `training_sessions_select`
   - `training_sessions_insert`
   - `training_sessions_update`
   - `training_sessions_delete`
   - `rubric_templates_select`
   - `rubric_templates_manage`
