-- Fix: Ensure auto_revert_expired_pending functions have fixed search_path
-- These functions were flagged for having a role mutable search_path
-- Functions should have explicit search_path to prevent unexpected behavior

CREATE OR REPLACE FUNCTION public.auto_revert_expired_pending_bookings()
RETURNS TABLE(
  reverted_count integer,
  lead_ids uuid[]
)
LANGUAGE plpgsql
SET search_path = public
AS $$
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
      ru.name as room_name
    FROM bookings b
    JOIN organizations o ON o.id = b.organization_id
    JOIN leads l ON l.id = b.lead_id
    LEFT JOIN room_units ru ON ru.id = b.room_unit_id
    WHERE b.status = 'pending'
      AND o.ai_agent_type = 'cece'
      AND b.check_in::date < v_grace_date
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
        AND (np.id IS NULL OR np.lead_notifications = true)
    LOOP
      INSERT INTO notifications (
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
$$;

DROP FUNCTION IF EXISTS public.auto_revert_expired_pending_orders();

CREATE OR REPLACE FUNCTION public.auto_revert_expired_pending_orders()
RETURNS TABLE(
  reverted_count integer,
  lead_ids uuid[]
)
LANGUAGE plpgsql
SET search_path = public
AS $$
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
        AND (np.id IS NULL OR np.lead_notifications = true)
    LOOP
      INSERT INTO notifications (
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
        format('Order for %s (pickup: %s) expired without confirmation. Pickup was scheduled for %s. Lead reverted to New status.',
          COALESCE(v_order.lead_name, 'Customer'),
          COALESCE(v_order.pickup_name, 'Not specified'),
          to_char(v_order.pickup_time, 'Mon DD, YYYY HH:MI AM')
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
$$;

COMMENT ON FUNCTION public.auto_revert_expired_pending_bookings() IS 'Auto-revert expired pending bookings back to new lead status with fixed search_path';
COMMENT ON FUNCTION public.auto_revert_expired_pending_orders() IS 'Auto-revert expired pending orders back to new lead status with fixed search_path';
