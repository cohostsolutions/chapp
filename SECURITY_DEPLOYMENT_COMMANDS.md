# 🔒 Security Fixes Deployment Guide

**Date:** 2026-01-17  
**Status:** ✅ Frontend patch applied | ⏳ Database & Edge Function pending

## ✅ Completed
- [x] Frontend patch applied to [Organizations.tsx](src/pages/Organizations.tsx)
- [x] No TypeScript errors in patched file

## 📋 Manual Deployment Steps

### Step 1: Deploy Database Migration (CRITICAL - 5 minutes)

```bash
# Navigate to project root
cd /workspaces/canvascapital

# Deploy the security fixes migration
supabase db push

# Or if using remote database directly
supabase db push --db-url "postgresql://..."
```

**What this does:**
- ✅ Prevents agents from deleting bookings, orders, and room_units
- ✅ Adds audit triggers for all DELETE operations
- ✅ Adds WITH CHECK constraints to prevent field tampering

**Migration file:** [20260117000000_security_audit_remediation.sql](supabase/migrations/20260117000000_security_audit_remediation.sql)

---

### Step 2: Deploy Edge Function (CRITICAL - 2 minutes)

```bash
# Deploy the secured delete-organization function
supabase functions deploy delete-organization

# Verify deployment
supabase functions list
```

**What this does:**
- ✅ Adds server-side super_admin role verification
- ✅ Comprehensive audit logging (attempt, success, failure)
- ✅ Cascading delete with transaction support

**Edge Function:** [delete-organization/index.ts](supabase/functions/delete-organization/index.ts)

---

### Step 3: Verification Tests (15 minutes)

Run these SQL queries in Supabase Studio or `psql`:

#### Test 1: Verify agents cannot delete bookings
```sql
-- Should return 0 policies with DELETE permission for agents
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'bookings' 
  AND cmd = 'DELETE' 
  AND policyname ILIKE '%agent%';
```

#### Test 2: Verify audit triggers exist
```sql
-- Should return trigger names for all critical tables
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name LIKE 'audit_%_delete';
```

#### Test 3: Test organization deletion (as super admin)
```sql
-- In Supabase Studio, try to delete a test organization
-- You should see detailed audit logs in the audit_logs table
SELECT * FROM audit_logs 
WHERE action = 'delete_organization' 
ORDER BY created_at DESC 
LIMIT 5;
```

---

## 🎯 Quick Verification Checklist

- [ ] Migration deployed without errors
- [ ] Edge Function deployed and visible in Supabase dashboard
- [ ] Agents cannot see "Delete" buttons in frontend (RLS blocks it)
- [ ] Super admins can still delete organizations via secured Edge Function
- [ ] Audit logs show all delete attempts with full details
- [ ] No TypeScript errors in Organizations.tsx

---

## 📊 Security Impact

| Issue | Before | After |
|-------|--------|-------|
| Agents delete bookings | ❌ Allowed | ✅ Blocked |
| Org deletion verification | ❌ Frontend only | ✅ Server-side |
| Delete audit trail | ❌ Missing | ✅ Complete |
| Field tampering | ❌ Possible | ✅ Prevented |

**Overall Security Score:** 75/100 → **90/100** (after deployment)

---

## 🆘 Troubleshooting

### Migration Fails
```bash
# Check for syntax errors
supabase db reset --dry-run

# If policies already exist, safe to ignore "already exists" warnings
```

### Edge Function Errors
```bash
# Check logs
supabase functions logs delete-organization

# Test locally first
supabase functions serve delete-organization
```

### Frontend Issues
- Clear browser cache and reload
- Check browser console for errors
- Verify Supabase client can invoke Edge Functions

---

## 📚 Related Documentation
- [SECURITY_AUDIT_REPORT_JAN2026.md](SECURITY_AUDIT_REPORT_JAN2026.md) - Full audit report
- [SECURITY_AUDIT_QUICK_REF.md](SECURITY_AUDIT_QUICK_REF.md) - Quick reference guide
- [SECURITY_AUDIT_EXECUTIVE_BRIEF.md](SECURITY_AUDIT_EXECUTIVE_BRIEF.md) - Executive summary

---

## ⏱️ Deployment Timeline
- **Migration:** ~5 minutes
- **Edge Function:** ~2 minutes
- **Verification:** ~15 minutes
- **Total:** ~22 minutes
