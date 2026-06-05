# 🚨 URGENT: DEPLOYMENT STEPS - DO THIS NOW

**The code is in git, but NOT in production yet.**

## Status Check
- ✅ Code committed to GitHub (commit e0e4286)
- ⏳ Vercel rebuild: TRIGGERED (monitor dashboard)
- ❌ Supabase database: NOT deployed
- ❌ Supabase functions: NOT deployed

**Nothing will work until you complete ALL THREE steps below.**

---

## STEP 1: Vercel Deployment (AUTOMATIC - Just Wait)

**Timeline**: 2-3 minutes

1. Go to: https://vercel.com/dashboard
2. Wait for deployment to complete
3. Check that commit `e0e4286` is deployed
4. Test in browser:
   - Go to /chats - should NOT overflow
   - Check browser console - v1 error should be GONE
   - Go to Bookings - "New" status should appear in dropdown with blue color

**This step is already in progress. Just monitor it.**

---

## STEP 2: Supabase Database Migration (MANUAL - DO THIS NOW)

1. Go to: https://supabase.com/dashboard
2. Select your Canvas Capital project
3. Click: **SQL Editor** (left sidebar)
4. Click: **New Query**
5. Copy this entire SQL and paste it:

```sql
-- ==================================================
-- AUTO-REVERT "NEW" STATUS BOOKINGS - GRACE PERIOD
-- Date: 2026-01-18
-- ==================================================

CREATE OR REPLACE FUNCTION public.auto_revert_expired_new_bookings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grace_date timestamp := NOW() - INTERVAL '1 day';
  v_reverted_count integer := 0;
  v_lead_ids uuid[] := ARRAY[]::uuid[];
  v_booking record;
BEGIN
  FOR v_booking IN
    SELECT b.id, b.lead_id, b.organization_id, l.name as lead_name, r.name as room_name
    FROM bookings b
    JOIN leads l ON b.lead_id = l.id
    JOIN room_units r ON b.room_unit_id = r.id
    WHERE b.status = 'new'
      AND b.created_at < v_grace_date
      AND b.organization_id IS NOT NULL
  LOOP
    BEGIN
      UPDATE bookings
      SET status = 'cancelled'
      WHERE id = v_booking.id;
      
      UPDATE leads
      SET status = 'new'
      WHERE id = v_booking.lead_id;
      
      INSERT INTO notification_history (
        organization_id,
        user_id,
        type,
        title,
        message,
        related_type,
        related_id,
        is_muted,
        created_at
      )
      SELECT
        v_booking.organization_id,
        u.id,
        'booking'::text,
        'Unconfirmed Booking Expired'::text,
        format(
          'Booking for %s (%s) was not confirmed. Created on %s. Lead reverted to New status.',
          v_booking.lead_name,
          v_booking.room_name,
          TO_CHAR(v_booking.created_at AT TIME ZONE 'UTC', 'Mon DD, YYYY')
        )::text,
        'lead'::text,
        v_booking.lead_id,
        true,
        NOW()
      FROM profile_organization_access poa
      JOIN profiles u ON poa.user_id = u.id
      WHERE poa.organization_id = v_booking.organization_id
        AND poa.role IN ('admin', 'manager');
      
      v_reverted_count := v_reverted_count + 1;
      v_lead_ids := array_append(v_lead_ids, v_booking.lead_id);
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error auto-reverting booking %: %', v_booking.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'reverted_count', v_reverted_count,
    'lead_ids', v_lead_ids
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_revert_expired_new_bookings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_revert_expired_new_bookings() TO service_role;

CREATE INDEX IF NOT EXISTS idx_bookings_new_created
ON bookings(status, created_at)
WHERE status = 'new';

ALTER TABLE notification_history
ADD COLUMN IF NOT EXISTS is_muted boolean DEFAULT false;

COMMENT ON FUNCTION public.auto_revert_expired_new_bookings() IS
'Auto-reverts "new" status bookings that have not been confirmed after 1 day.';
```

6. Click: **Run** (blue button, top right)
7. You should see: "Query executed successfully" ✓

---

## STEP 3: Supabase Cloud Function (MANUAL - DO THIS AFTER STEP 2)

1. Still in Supabase Dashboard
2. Click: **Functions** (left sidebar)
3. Find: `auto-update-booking-status`
4. Click on it to open the editor
5. Replace the contents with the complete file from:
   `/workspaces/canvascapital/supabase/functions/auto-update-booking-status/index.ts`

**OR** if that's too complex, just verify this line exists (around line 346):

```typescript
const { data: newBookingRevertResult, error: newBookingRevertError } = await supabase
  .rpc('auto_revert_expired_new_bookings');
```

6. Click: **Deploy** button
7. Wait for deployment to complete
8. You should see: "Function deployed successfully" ✓

---

## VERIFICATION CHECKLIST

After all 3 steps are deployed:

- [ ] Vercel build complete (check dashboard)
- [ ] Supabase migration executed (check SQL Editor history)
- [ ] Cloud function deployed (check Functions list)

### Test in Your App:

- [ ] Open browser console - NO v1 errors
- [ ] Go to /chats - conversation list doesn't overflow text
- [ ] Go to Bookings - "New" status appears in dropdown
- [ ] Check new booking status color - should be blue (bg-blue-500/20)
- [ ] Create test booking - should have "New" status

---

## IF SOMETHING BREAKS

**Which system is broken?**

**If frontend is broken (Vercel)**:
- Check Vercel dashboard for build errors
- Common issue: v1 error still showing = Vercel hasn't deployed yet (just wait)

**If database function fails**:
- Run Step 2 again (SQL migration)
- Check Supabase SQL Editor for errors
- Verify all tables exist (bookings, leads, notification_history)

**If RPC call fails**:
- Run Step 3 again (Cloud Function)
- Verify the function name: `auto_revert_expired_new_bookings`
- Check cloud function logs in Supabase Dashboard

---

## TIMELINE

```
Right now (T+0)    : Vercel rebuild in progress
After 2-3 min      : Vercel deploy complete ✓
Right now (T+0)    : You should do Step 2 (DB migration)
Right now (T+5)    : You should do Step 3 (Cloud function)
After 10-15 min    : Everything should be working ✓
```

---

## FINAL STATUS

**Currently deployed in production:**
- Commit: NOT YET - Vercel rebuilding
- Database: Old version (no auto-revert function)
- Functions: Old version (no RPC call)

**What will be deployed after you complete these steps:**
- Code: Conversation list fix + new booking status UI
- Database: Auto-revert function for "new" bookings after 1 day
- Functions: RPC call to execute auto-revert on schedule

This is why nothing changed yet. All three systems must be updated.

---

**Do Steps 2 and 3 NOW while Vercel completes Step 1.**

Need help? This file has everything you need.
