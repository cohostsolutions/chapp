# Security Fix: SECURITY DEFINER Functions Missing search_path

**Date:** January 21, 2026  
**Severity:** 🟡 HIGH  
**Status:** ✅ FIXED

---

## Summary

Fixed 5 `SECURITY DEFINER` functions that were vulnerable to privilege escalation via schema shadowing attacks. All functions now have explicit `search_path` set to prevent malicious schema injection.

---

## Vulnerability Details

### What Was Wrong?

Functions declared with `SECURITY DEFINER` run with the privileges of the function **owner** (typically `postgres`), not the caller. Without an explicit `search_path`, these functions inherit the caller's search path, which can be manipulated to:

1. **Schema Shadowing**: Attacker creates malicious tables/functions in a schema earlier in search_path
2. **Privilege Escalation**: SECURITY DEFINER function calls attacker's code with elevated privileges
3. **Data Exfiltration**: Malicious code can read/modify any data

### Example Attack

```sql
-- Attacker creates malicious schema
CREATE SCHEMA evil;
SET search_path = evil, public;

-- Attacker creates fake "profiles" table
CREATE TABLE evil.profiles (id uuid, ...);

-- When vulnerable function runs, it uses evil.profiles instead of public.profiles!
SELECT * FROM profiles WHERE id = _user_id; -- ← Uses evil.profiles!
```

---

## Fixed Functions

### 1. `check_alert_thresholds()`
- **File**: [20260109000000_alert_system.sql](../supabase/migrations/20260109000000_alert_system.sql#L43)
- **Purpose**: Check metric thresholds and trigger alerts
- **Risk**: Could be hijacked to read/modify any organization's data
- **Fix**: Added `SET search_path = public, pg_catalog`

### 2. `send_alert_notifications()`
- **File**: [20260109000000_alert_system.sql](../supabase/migrations/20260109000000_alert_system.sql#L177)
- **Purpose**: Send email notifications for triggered alerts
- **Risk**: Could leak alert data or send spam emails
- **Fix**: Added `SET search_path = public, pg_catalog`

### 3. `auto_checkout_from_chat()`
- **File**: [20260105021817_89c8aa74-90e9-4417-824c-e5637b1ca133.sql](../supabase/migrations/20260105021817_89c8aa74-90e9-4417-824c-e5637b1ca133.sql#L2)
- **Purpose**: Auto-checkout guests when they mention keywords
- **Risk**: Could manipulate booking statuses or leak guest data
- **Fix**: Added `SET search_path = public, pg_catalog`

### 4. `run_booking_status_updates()`
- **File**: [20260105021817_89c8aa74-90e9-4417-824c-e5637b1ca133.sql](../supabase/migrations/20260105021817_89c8aa74-90e9-4417-824c-e5637b1ca133.sql#L71)
- **Purpose**: Auto-update booking statuses based on dates
- **Risk**: Could mark bookings as checked-in/out maliciously
- **Fix**: Added `SET search_path = public, pg_catalog`

### 5. `training_stats()`
- **File**: [20241226120000_training.sql](../supabase/migrations/20241226120000_training.sql#L205)
- **Purpose**: Calculate training statistics for organizations
- **Risk**: Could return fake statistics or leak training data
- **Fix**: Added `SET search_path = public, pg_catalog`

---

## Migration Applied

**File**: [supabase/migrations/20260121100002_fix_security_definer_search_path.sql](../supabase/migrations/20260121100002_fix_security_definer_search_path.sql)

### What It Does

1. ✅ Recreates all 5 vulnerable functions with `SET search_path = public, pg_catalog`
2. ✅ Preserves original function logic (no behavioral changes)
3. ✅ Verifies all SECURITY DEFINER functions now have search_path
4. ✅ Reports success/failure via RAISE NOTICE

### To Apply

```bash
# Apply migration
supabase db push

# Or apply directly
psql "$DATABASE_URL" -f supabase/migrations/20260121100002_fix_security_definer_search_path.sql
```

### Expected Output

```
NOTICE: ✅ SUCCESS: All SECURITY DEFINER functions now have explicit search_path
```

---

## Audit Script

An audit script was created to detect future violations:

**File**: [supabase/migrations/20260121100001_audit_search_path.sql](../supabase/migrations/20260121100001_audit_search_path.sql)

### Run Audit Anytime

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260121100001_audit_search_path.sql
```

Will report any SECURITY DEFINER functions without explicit search_path.

---

## Best Practices

### ✅ DO

1. **Always set search_path** on SECURITY DEFINER functions:
   ```sql
   CREATE FUNCTION my_func()
   ...
   SECURITY DEFINER
   SET search_path = pg_catalog, public  -- ← REQUIRED
   ```

2. **Use minimal search_path**:
   - Start with `pg_catalog` (PostgreSQL builtins only)
   - Add `public` only if needed
   - Never include `pg_temp` or user schemas

3. **Schema-qualify all references** inside function body:
   ```sql
   SELECT * FROM public.users WHERE id = _user_id;
   -- NOT: SELECT * FROM users WHERE id = _user_id;
   ```

4. **Use SECURITY INVOKER** when possible (default, safer):
   ```sql
   CREATE FUNCTION my_func()
   ...
   SECURITY INVOKER  -- Runs with caller's privileges
   ```

### ❌ DON'T

1. ❌ Never rely on caller's search_path in SECURITY DEFINER functions
2. ❌ Never include `pg_temp` in search_path (temporary objects are unsafe)
3. ❌ Never use SECURITY DEFINER without explicit search_path
4. ❌ Never assume `public` schema is first in path

---

## Verification

### Check Current Status

```sql
-- List all SECURITY DEFINER functions with their search_path
SELECT 
  n.nspname || '.' || p.proname AS function_name,
  CASE WHEN prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security,
  COALESCE(array_to_string(proconfig, ', '), 'NONE') AS search_path
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND prosecdef = true
ORDER BY p.proname;
```

### Expected: All functions show `search_path = ...`

---

## References

- [PostgreSQL SECURITY DEFINER Documentation](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)
- [search_path Security Best Practices](https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATH)
- [SECURITY.md](../SECURITY.md#known-security-issues)

---

## Contact

For questions about this security fix, review the migration file or contact the database team.
