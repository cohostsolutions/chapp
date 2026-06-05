# 🚨 Security Issue: message_template_assignments - Orphaned Table

**Date:** January 21, 2026  
**Status:** ACTION REQUIRED - DROP TABLE

## Quick Summary

The lint warning is **VALID**. An orphaned table `message_template_assignments` exists with:
- ❌ **NO RLS enabled** (security vulnerability)  
- ❌ **NO code usage** (not used anywhere)  
- ❌ **NO migration file** (created manually)

## Table Details

```sql
Columns: template_id, user_id, created_at
Foreign Keys: → message_templates, → auth.users  
RLS: DISABLED ⚠️
Code Usage: NONE
```

## Security Risk

**Current:** 🟡 MEDIUM  
- Table is accessible without restrictions
- No immediate exploit (no code uses it)
- Risk if someone adds code without enabling RLS

## Recommended Action: DROP

Migration already created and ready to apply:

```bash
# Apply the drop migration
supabase db push

# File: supabase/migrations/20260121000000_drop_message_template_assignments.sql
```

## What The Migration Does

1. ✅ Verifies table exists
2. ✅ Checks RLS status  
3. ✅ Counts rows (warns if data present)
4. ✅ Drops table safely with CASCADE
5. ✅ Verifies successful removal

## Alternative (Not Recommended)

If you need user-specific template assignments in the future, **DO NOT use this table**. Drop it now and recreate properly with RLS when needed.

## Files Updated

1. **[supabase/migrations/20260121000000_drop_message_template_assignments.sql](supabase/migrations/20260121000000_drop_message_template_assignments.sql)** - Safe drop migration
2. **[MESSAGE_TEMPLATE_ASSIGNMENTS_FALSE_POSITIVE.md](MESSAGE_TEMPLATE_ASSIGNMENTS_FALSE_POSITIVE.md)** - Full investigation
3. **[SECURITY.md](SECURITY.md#known-security-issues)** - Security documentation updated
