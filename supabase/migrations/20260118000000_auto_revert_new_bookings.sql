-- ==================================================
-- AUTO-REVERT "NEW" STATUS BOOKINGS - GRACE PERIOD
-- Date: 2026-01-18
-- Purpose: Add auto-revert logic for "new" status bookings with 1-day grace period
-- Reference: COMPONENT_LOCATION_PROTOCOL.md, BookingsTabContent.tsx
-- ==================================================

-- ============================================
-- Function: auto_revert_expired_new_bookings()
-- ============================================
-- Purpose: Auto-revert "new" status bookings that haven't been confirmed
--          after 1 day of creation. Mirrors existing pending auto-revert pattern.
--
-- Behavior:
--   1. Find "new" bookings older than 1 day (created_at < NOW - 1 day)
--   2. Keep the booking (don't delete) - mark as "cancelled" instead
--   3. Update lead status back to "new"
--   4. Create muted notification for org members
--
-- Returns: { reverted_count: integer, lead_ids: uuid[] }
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
  v_notification_id uuid;
BEGIN
  -- Find all "new" status bookings created more than 1 day ago
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
      -- Mark booking as cancelled instead of deleting (keep audit trail)
      UPDATE bookings
      SET status = 'cancelled'
      WHERE id = v_booking.id;
      
      -- Update lead status back to "new" (allows re-engagement)
      UPDATE leads
      SET status = 'new'
      WHERE id = v_booking.lead_id;
      
      -- Create muted notification for org members
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
        true,  -- is_muted = true (silent notification)
        NOW()
      FROM profile_organization_access poa
      JOIN profiles u ON poa.user_id = u.id
      WHERE poa.organization_id = v_booking.organization_id
        AND poa.role IN ('admin', 'manager');
      
      v_reverted_count := v_reverted_count + 1;
      v_lead_ids := array_append(v_lead_ids, v_booking.lead_id);
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue processing other bookings
      RAISE NOTICE 'Error auto-reverting booking %: %', v_booking.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'reverted_count', v_reverted_count,
    'lead_ids', v_lead_ids
  );
END;
$$;

-- ============================================
-- Grant permissions
-- ============================================
GRANT EXECUTE ON FUNCTION public.auto_revert_expired_new_bookings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_revert_expired_new_bookings() TO service_role;

-- ============================================
-- Create index for "new" status bookings
-- ============================================
-- Optimizes queries for finding expired "new" bookings
CREATE INDEX IF NOT EXISTS idx_bookings_new_created
ON bookings(status, created_at)
WHERE status = 'new';

-- ============================================
-- Schema Update: Ensure is_muted column exists
-- ============================================
-- (May already exist from previous migrations)
ALTER TABLE notification_history
ADD COLUMN IF NOT EXISTS is_muted boolean DEFAULT false;

-- ============================================
-- Comment for documentation
-- ============================================
COMMENT ON FUNCTION public.auto_revert_expired_new_bookings() IS
'Auto-reverts "new" status bookings that have not been confirmed after 1 day.
  - Marks booking as "cancelled" (keeps audit trail)
  - Sets lead back to "new" status for re-engagement
  - Creates muted notifications for admin/manager team members
  - Called by auto-update-booking-status cloud function on schedule';
