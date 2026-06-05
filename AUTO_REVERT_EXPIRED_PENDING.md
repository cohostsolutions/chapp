# Auto-Revert Expired Pending Bookings/Orders - Implementation Summary

## Overview
Automatically reverts leads back to "New" status when their pending bookings (Cece orgs) or pending orders (May orgs) expire without confirmation. This ensures leads don't get stuck in limbo and can be re-engaged.

## Implementation Date
January 17, 2026

## Key Features

### 1. **Grace Period**
- **1-day grace period** after the check-in date (Cece) or pickup time (May)
- Allows time for late confirmations before auto-reverting

### 2. **Automatic Cleanup**
- **Deletes** expired pending bookings/orders (not marked as cancelled)
- Rationale: Pending items were never confirmed, so "cancelled" status doesn't apply

### 3. **Lead Status Reversion**
- Automatically sets lead status back to `'new'`
- Leads can be re-engaged by the sales/accommodation team

### 4. **Muted Notifications**
- Creates notifications with `is_muted = true` flag
- Appears in notification history and alerts dialog
- **No sound alerts** - silent notification for bulk cleanup operations

### 5. **Organization-Specific Behavior**
- **Cece (Accommodation)**: Triggered by expired check-in dates
- **May (Food/Restaurant)**: Triggered by expired pickup times
- **Jay (Sales)**: No auto-revert (manual management only)

---

## Database Changes

### Migration: `20260117220000_auto_revert_expired_pending.sql`

#### New Functions

**1. `auto_revert_expired_pending_bookings()`**
- **Purpose**: Auto-revert expired pending bookings for Cece organizations
- **Trigger Condition**: `check_in < (CURRENT_DATE - 1 day)` AND `status = 'pending'`
- **Actions**:
  1. Updates lead status to `'new'`
  2. Deletes the expired pending booking
  3. Creates muted notification for org members
- **Returns**: `{ reverted_count: integer, lead_ids: uuid[] }`

**2. `auto_revert_expired_pending_orders()`**
- **Purpose**: Auto-revert expired pending orders for May organizations
- **Trigger Condition**: `pickup_time < (NOW() - 1 day)` AND `status = 'pending'`
- **Actions**:
  1. Updates lead status to `'new'`
  2. Deletes the expired pending order
  3. Creates muted notification for org members
- **Returns**: `{ reverted_count: integer, lead_ids: uuid[] }`

#### Schema Updates

**notification_history table:**
```sql
ALTER TABLE notification_history 
ADD COLUMN IF NOT EXISTS is_muted boolean DEFAULT false;
```
- Flags notifications that should not trigger sound alerts
- Default: `false` (normal notifications play sounds)

**New Indexes:**
```sql
CREATE INDEX idx_bookings_pending_checkin 
ON bookings(status, check_in) WHERE status = 'pending';

CREATE INDEX idx_orders_pending_pickup 
ON orders(status, pickup_time) WHERE status = 'pending' AND pickup_time IS NOT NULL;
```
- Optimizes queries for expired pending items

---

## Backend Changes

### Edge Function: `auto-update-booking-status/index.ts`

Added auto-revert logic to the existing scheduled function:

```typescript
// ========== AUTO-REVERT EXPIRED PENDING BOOKINGS/ORDERS ==========
try {
  // Auto-revert expired pending bookings (Cece)
  const { data: bookingRevertResult } = await supabase
    .rpc('auto_revert_expired_pending_bookings');
  
  // Auto-revert expired pending orders (May)
  const { data: orderRevertResult } = await supabase
    .rpc('auto_revert_expired_pending_orders');
} catch (revertError) {
  console.error('Exception during auto-revert process:', revertError);
}
```

**Response Updated:**
```json
{
  "success": true,
  "checked_in": 5,
  "checked_out": 3,
  "reverted_bookings": 2,  // NEW
  "reverted_orders": 1,     // NEW
  "date": "2026-01-17"
}
```

---

## Frontend Changes

### Updated: `src/hooks/useNotificationHistory.ts`

**NotificationHistoryItem Interface:**
```typescript
export interface NotificationHistoryItem {
  // ...existing fields
  is_muted: boolean | null;  // NEW: Indicates muted notifications
}
```

**UI Behavior:**
- Muted notifications appear in the notification dropdown
- Muted notifications appear in `/notifications` page
- **No sound alerts** for muted notifications
- Visual display identical to normal notifications

---

## Notification Examples

### Expired Pending Booking (Cece)
```
Title: "Expired Pending Booking"
Message: "Booking for John Doe (Deluxe Suite) expired without confirmation. 
         Check-in was scheduled for Jan 15, 2026. Lead reverted to New status."
Type: "lead"
Related ID: [lead_id]
is_muted: true
```

### Expired Pending Order (May)
```
Title: "Expired Pending Order"
Message: "Order for Maria Santos expired without confirmation. 
         Pickup was scheduled for Jan 16, 2026 at 02:00 PM. 
         Lead reverted to New status."
Type: "lead"
Related ID: [lead_id]
is_muted: true
```

---

## How It Works

### Workflow Diagram
```
┌─────────────────────────────────────────────────────────────┐
│ Scheduled Job: auto-update-booking-status (runs daily)     │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────┐
         │  Check Cece Organizations       │
         │  Find pending bookings where:   │
         │  check_in < (today - 1 day)     │
         └─────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  For each booking:     │
              │  1. Set lead → 'new'   │
              │  2. DELETE booking     │
              │  3. Notify org members │
              └────────────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────┐
         │  Check May Organizations        │
         │  Find pending orders where:     │
         │  pickup_time < (now - 1 day)    │
         └─────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  For each order:       │
              │  1. Set lead → 'new'   │
              │  2. DELETE order       │
              │  3. Notify org members │
              └────────────────────────┘
```

### Grace Period Calculation

**Cece (Bookings):**
```sql
-- Check-in: Jan 15, 2026
-- Today: Jan 17, 2026
-- Grace date: Jan 16, 2026
-- Status: EXPIRED (check_in < grace_date)
check_in < (CURRENT_DATE - INTERVAL '1 day')
```

**May (Orders):**
```sql
-- Pickup: Jan 16, 2026 2:00 PM
-- Now: Jan 17, 2026 3:00 PM
-- Grace time: Jan 16, 2026 3:00 PM
-- Status: EXPIRED (pickup_time < grace_time)
pickup_time < (NOW() - INTERVAL '1 day')
```

---

## Testing Instructions

### 1. **Database Migration**
```bash
# Deploy migration
supabase db push

# Verify functions exist
supabase db execute "SELECT proname FROM pg_proc WHERE proname LIKE 'auto_revert%';"
```

### 2. **Create Test Data**

**Test Expired Booking (Cece):**
```sql
-- Insert test lead
INSERT INTO leads (organization_id, name, phone, status, source)
VALUES ('[cece_org_id]', 'Test Guest', '1234567890', 'qualified', 'manual')
RETURNING id;

-- Insert expired pending booking (check-in 3 days ago)
INSERT INTO bookings (
  organization_id, lead_id, room_unit_id, 
  check_in, check_out, guest_count, status
)
VALUES (
  '[cece_org_id]', '[lead_id]', '[room_id]',
  CURRENT_DATE - INTERVAL '3 days',  -- Expired!
  CURRENT_DATE + INTERVAL '2 days',
  2, 'pending'
);
```

**Test Expired Order (May):**
```sql
-- Insert test lead
INSERT INTO leads (organization_id, name, phone, status, source)
VALUES ('[may_org_id]', 'Test Customer', '0987654321', 'qualified', 'manual')
RETURNING id;

-- Insert expired pending order (pickup 2 days ago)
INSERT INTO orders (
  organization_id, lead_id, 
  pickup_name, pickup_time, order_items, status
)
VALUES (
  '[may_org_id]', '[lead_id]',
  'Test Customer', NOW() - INTERVAL '2 days',  -- Expired!
  '[{"name": "Test Item", "quantity": 1, "price": 100}]'::jsonb,
  'pending'
);
```

### 3. **Run Auto-Update Function**
```bash
# Trigger the Edge Function
curl -X POST https://[project-ref].supabase.co/functions/v1/auto-update-booking-status \
  -H "Authorization: Bearer [anon-key]" \
  -H "Content-Type: application/json"
```

### 4. **Verify Results**

**Check Lead Status:**
```sql
SELECT id, name, status FROM leads WHERE name IN ('Test Guest', 'Test Customer');
-- Expected: status = 'new'
```

**Check Bookings/Orders Deleted:**
```sql
SELECT * FROM bookings WHERE status = 'pending' AND check_in < CURRENT_DATE - 1;
-- Expected: 0 rows (deleted)

SELECT * FROM orders WHERE status = 'pending' AND pickup_time < NOW() - INTERVAL '1 day';
-- Expected: 0 rows (deleted)
```

**Check Notifications Created:**
```sql
SELECT title, message, is_muted, type
FROM notification_history
WHERE title LIKE '%Expired Pending%'
ORDER BY created_at DESC
LIMIT 5;
-- Expected: Notifications with is_muted = true
```

### 5. **Manual UI Testing**

1. **View Notifications**:
   - Navigate to notification bell icon (top-right)
   - Expired pending notifications should appear
   - **No sound should play** when viewing these

2. **Check Lead Kanban Board**:
   - Navigate to `/sales-operations?tab=leads` (Cece) or `/menu-and-orders` (May)
   - Reverted leads should appear in "New" column

3. **Notification History Page**:
   - Navigate to `/notifications`
   - Filter by type: "Lead"
   - Expired pending notifications should be visible

---

## Manual Lead Status Change

### Already Supported!

Users can manually change lead status back to "New" through:

**1. Lead Kanban Board:**
- Drag lead card to "New" column
- Status updates automatically

**2. Lead Info Dialog:**
- Click on any lead card
- Click "Status" dropdown
- Select "New"

**3. Leads Table:**
- Right-click lead → "Change Status" → "New"

All lead statuses support manual changes, including:
- `new` ← **Target for reverted leads**
- `contacted`
- `qualified`
- `converted`
- `lost`

---

## Monitoring & Alerts

### Logs to Monitor

**Edge Function Logs:**
```bash
# Check auto-revert execution
supabase functions logs auto-update-booking-status --tail

# Look for:
# "Auto-reverted X expired pending bookings (Cece)"
# "Auto-reverted X expired pending orders (May)"
# "Reverted expired pending booking [id] for lead [name]"
```

**Database Logs:**
```sql
-- Check recent reverts
SELECT 
  title, 
  message, 
  created_at,
  is_muted
FROM notification_history
WHERE title LIKE '%Expired Pending%'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### Performance Metrics

**Query Performance:**
```sql
-- Check index usage
EXPLAIN ANALYZE
SELECT * FROM bookings 
WHERE status = 'pending' 
  AND check_in < CURRENT_DATE - 1;

-- Expected: Uses idx_bookings_pending_checkin
```

---

## Configuration

### Scheduled Execution

The auto-revert function runs as part of the existing `auto-update-booking-status` Edge Function.

**Current Schedule:**
- Triggered via Supabase Cron or external scheduler
- Recommended: **Daily at 2:00 AM** (low-traffic period)

**Supabase Cron Setup (if not already configured):**
```sql
-- In Supabase Dashboard → Database → Cron Jobs
SELECT cron.schedule(
  'auto-update-booking-status',
  '0 2 * * *',  -- Every day at 2 AM
  $$
  SELECT net.http_post(
    url := 'https://[project-ref].functions.supabase.co/auto-update-booking-status',
    headers := jsonb_build_object('Authorization', 'Bearer [service-role-key]')
  )
  $$
);
```

### Notification Preferences

Users can control which notifications they receive via `/settings/notifications`:
- `notify_lead_status_change` preference controls auto-revert notifications
- Muted notifications **never play sound** regardless of preferences

---

## Rollback Plan

If issues arise, here's how to rollback:

### 1. **Disable Auto-Revert (Quick Fix)**
```sql
-- Temporarily rename functions to disable
ALTER FUNCTION auto_revert_expired_pending_bookings() 
RENAME TO auto_revert_expired_pending_bookings_disabled;

ALTER FUNCTION auto_revert_expired_pending_orders() 
RENAME TO auto_revert_expired_pending_orders_disabled;
```

### 2. **Full Rollback**
```sql
-- Drop functions
DROP FUNCTION IF EXISTS auto_revert_expired_pending_bookings();
DROP FUNCTION IF EXISTS auto_revert_expired_pending_orders();

-- Remove column
ALTER TABLE notification_history DROP COLUMN IF EXISTS is_muted;

-- Drop indexes
DROP INDEX IF EXISTS idx_bookings_pending_checkin;
DROP INDEX IF EXISTS idx_orders_pending_pickup;
```

### 3. **Revert Edge Function**
```bash
# Use git to revert the file
git checkout HEAD~1 supabase/functions/auto-update-booking-status/index.ts
supabase functions deploy auto-update-booking-status
```

---

## FAQ

**Q: What happens to leads with multiple pending bookings/orders?**
A: Each expired item is processed independently. The lead status is set to 'new' multiple times (idempotent), and separate notifications are created for each expired item.

**Q: Can I adjust the grace period?**
A: Yes! Edit the functions in the migration:
```sql
-- Change from 1 day to 2 days
v_grace_date := CURRENT_DATE - INTERVAL '2 days';
v_grace_time := now() - INTERVAL '2 days';
```

**Q: What if a booking/order doesn't have a pickup_time?**
A: Orders without `pickup_time` are ignored (not processed by auto-revert).

**Q: Do cancelled bookings/orders trigger auto-revert?**
A: No. Only `status = 'pending'` items are processed.

**Q: Can agents see these muted notifications?**
A: Yes! They appear in the notification dropdown and history page, just without sound.

**Q: What if I want to manually revert a lead before the grace period?**
A: Agents can manually change the lead status to "New" at any time via the Lead Kanban Board or Lead Info Dialog.

---

## Future Enhancements

1. **Configurable Grace Period**: Add org-level setting for custom grace periods
2. **Email Notifications**: Send email summary of expired items
3. **Analytics Dashboard**: Track auto-revert metrics (volume, trends)
4. **Re-engagement Workflow**: Automatically send follow-up messages to reverted leads
5. **Audit Trail**: Log detailed history of auto-revert actions

---

## Related Documentation

- [Booking Status Workflow](./BOOKING_STATUS_WORKFLOW.md)
- [Lead Status Management](./LEAD_STATUS_MANAGEMENT.md)
- [Notification System](./NOTIFICATION_SYSTEM.md)
- [Auto-Update Booking Status](./AUTO_UPDATE_BOOKING_STATUS.md)

---

## Implementation Checklist

- [x] Create database migration with auto-revert functions
- [x] Add `is_muted` column to notification_history
- [x] Create indexes for efficient queries
- [x] Update auto-update-booking-status Edge Function
- [x] Update NotificationHistoryItem interface
- [x] Update response format with revert counts
- [x] Document implementation
- [ ] Deploy database migration
- [ ] Deploy Edge Function
- [ ] Test with sample data
- [ ] Monitor logs for first 24 hours
- [ ] Update user documentation

---

**Status**: ✅ **Implementation Complete** - Ready for deployment and testing
