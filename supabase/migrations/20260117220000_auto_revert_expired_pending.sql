-- Migration: Auto-revert expired pending bookings and orders back to "new" lead status
-- For Cece orgs: Delete pending bookings 1 day after check-in date passes
-- For May orgs: Delete pending orders 1 day after pickup time passes
-- Lead status reverts to "new" and a muted notification is created

-- Function to auto-revert expired pending bookings (Cece orgs)
CREATE OR REPLACE FUNCTION auto_revert_expired_pending_bookings()
RETURNS TABLE(
  reverted_count integer,
  lead_ids uuid[]
) AS $$
DECLARE
  v_booking RECORD;
  v_lead_name text;
  v_room_name text;
  v_org_name text;
  v_org_members RECORD;
  v_reverted_count integer := 0;
  v_lead_ids uuid[] := ARRAY[]::uuid[];
  v_grace_date date;
BEGIN
  -- Calculate grace date (1 day ago)
  v_grace_date := CURRENT_DATE - INTERVAL '1 day';
  
  -- Find all pending bookings from Cece orgs where check-in date + 1 day has passed
  FOR v_booking IN
    SELECT 
      b.id as booking_id,
      b.lead_id,
      b.organization_id,
      b.room_unit_id,
      b.check_in,
      b.check_out,
      o.name as org_name,
      l.name as lead_name,
      r.name as room_name
    FROM bookings b
    JOIN organizations o ON o.id = b.organization_id
    JOIN leads l ON l.id = b.lead_id
    LEFT JOIN room_units r ON r.id = b.room_unit_id
    WHERE b.status = 'pending'
      AND o.ai_agent_type = 'cece'
      AND b.check_in < v_grace_date
  LOOP
    -- Update lead status back to 'new'
    UPDATE leads
    SET 
      status = 'new',
      updated_at = now()
    WHERE id = v_booking.lead_id;
    
    -- Delete the expired pending booking (not cancelled, just removed)
    DELETE FROM bookings WHERE id = v_booking.booking_id;
    
    -- Create muted notifications for organization members
    FOR v_org_members IN
      SELECT p.id as user_id
      FROM profiles p
      LEFT JOIN notification_preferences np ON np.user_id = p.id
      WHERE p.organization_id = v_booking.organization_id
        AND p.is_active = true
        AND (np.notify_lead_status_change IS NULL OR np.notify_lead_status_change = true)
    LOOP
      INSERT INTO notification_history (
        user_id,
        organization_id,
        title,
        message,
        type,
        related_id,
        is_muted
      ) VALUES (
        v_org_members.user_id,
        v_booking.organization_id,
        'Expired Pending Booking',
        format('Booking for %s (%s) expired without confirmation. Check-in was scheduled for %s. Lead reverted to New status.',
          COALESCE(v_booking.lead_name, 'Guest'),
          COALESCE(v_booking.room_name, 'Room'),
          to_char(v_booking.check_in, 'Mon DD, YYYY')
        ),
        'lead',
        v_booking.lead_id,
        true  -- Muted notification (no sound)
      );
    END LOOP;
    
    v_reverted_count := v_reverted_count + 1;
    v_lead_ids := array_append(v_lead_ids, v_booking.lead_id);
    
    -- Log the action
    RAISE NOTICE 'Reverted expired pending booking % for lead % (check-in: %)', 
      v_booking.booking_id, v_booking.lead_name, v_booking.check_in;
  END LOOP;
  
  RETURN QUERY SELECT v_reverted_count, v_lead_ids;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-revert expired pending orders (May orgs)
CREATE OR REPLACE FUNCTION auto_revert_expired_pending_orders()
RETURNS TABLE(
  reverted_count integer,
  lead_ids uuid[]
) AS $$
DECLARE
  v_order RECORD;
  v_lead_name text;
  v_org_name text;
  v_org_members RECORD;
  v_reverted_count integer := 0;
  v_lead_ids uuid[] := ARRAY[]::uuid[];
  v_grace_time timestamp with time zone;
BEGIN
  -- Calculate grace time (1 day ago from now)
  v_grace_time := now() - INTERVAL '1 day';
  
  -- Find all pending orders from May orgs where pickup_time + 1 day has passed
  FOR v_order IN
    SELECT 
      ord.id as order_id,
      ord.lead_id,
      ord.organization_id,
      ord.pickup_time,
      ord.pickup_name,
      o.name as org_name,
      l.name as lead_name
    FROM orders ord
    JOIN organizations o ON o.id = ord.organization_id
    JOIN leads l ON l.id = ord.lead_id
    WHERE ord.status = 'pending'
      AND o.ai_agent_type = 'may'
      AND ord.pickup_time IS NOT NULL
      AND ord.pickup_time < v_grace_time
  LOOP
    -- Update lead status back to 'new'
    UPDATE leads
    SET 
      status = 'new',
      updated_at = now()
    WHERE id = v_order.lead_id;
    
    -- Delete the expired pending order (not cancelled, just removed)
    DELETE FROM orders WHERE id = v_order.order_id;
    
    -- Create muted notifications for organization members
    FOR v_org_members IN
      SELECT p.id as user_id
      FROM profiles p
      LEFT JOIN notification_preferences np ON np.user_id = p.id
      WHERE p.organization_id = v_order.organization_id
        AND p.is_active = true
        AND (np.notify_lead_status_change IS NULL OR np.notify_lead_status_change = true)
    LOOP
      INSERT INTO notification_history (
        user_id,
        organization_id,
        title,
        message,
        type,
        related_id,
        is_muted
      ) VALUES (
        v_org_members.user_id,
        v_order.organization_id,
        'Expired Pending Order',
        format('Order for %s expired without confirmation. Pickup was scheduled for %s. Lead reverted to New status.',
          COALESCE(v_order.lead_name, v_order.pickup_name, 'Customer'),
          to_char(v_order.pickup_time, 'Mon DD, YYYY at HH12:MI AM')
        ),
        'lead',
        v_order.lead_id,
        true  -- Muted notification (no sound)
      );
    END LOOP;
    
    v_reverted_count := v_reverted_count + 1;
    v_lead_ids := array_append(v_lead_ids, v_order.lead_id);
    
    -- Log the action
    RAISE NOTICE 'Reverted expired pending order % for lead % (pickup: %)', 
      v_order.order_id, v_order.lead_name, v_order.pickup_time;
  END LOOP;
  
  RETURN QUERY SELECT v_reverted_count, v_lead_ids;
END;
$$ LANGUAGE plpgsql;

-- Add is_muted column to notification_history if it doesn't exist
ALTER TABLE notification_history 
ADD COLUMN IF NOT EXISTS is_muted boolean DEFAULT false;

-- Add index for efficient querying of expired pending items
CREATE INDEX IF NOT EXISTS idx_bookings_pending_checkin 
ON bookings(status, check_in) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_orders_pending_pickup 
ON orders(status, pickup_time) 
WHERE status = 'pending' AND pickup_time IS NOT NULL;

-- Add comment explaining the functions
COMMENT ON FUNCTION auto_revert_expired_pending_bookings() IS 
'Automatically reverts leads back to "new" status when their pending bookings expire (1 day after check-in date). Only for Cece organizations. Deletes the pending booking and creates muted notifications.';

COMMENT ON FUNCTION auto_revert_expired_pending_orders() IS 
'Automatically reverts leads back to "new" status when their pending orders expire (1 day after pickup time). Only for May organizations. Deletes the pending order and creates muted notifications.';
