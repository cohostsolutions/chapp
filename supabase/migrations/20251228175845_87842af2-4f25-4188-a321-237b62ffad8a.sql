-- Migration: Convert calendar_sync_events to bookings with leads
-- This creates leads from guest info and links them to bookings

DO $$
DECLARE
  sync_event RECORD;
  new_lead_id UUID;
  existing_lead_id UUID;
BEGIN
  -- Loop through all calendar_sync_events
  FOR sync_event IN 
    SELECT * FROM public.calendar_sync_events 
    WHERE google_event_id NOT IN (
      SELECT calendar_event_id FROM public.bookings WHERE calendar_event_id IS NOT NULL
    )
  LOOP
    -- Try to find existing lead by email or phone in the same organization
    SELECT id INTO existing_lead_id
    FROM public.leads
    WHERE organization_id = sync_event.organization_id
      AND (
        (sync_event.guest_email IS NOT NULL AND email = sync_event.guest_email)
        OR (sync_event.guest_phone IS NOT NULL AND phone = sync_event.guest_phone)
      )
    LIMIT 1;

    IF existing_lead_id IS NOT NULL THEN
      new_lead_id := existing_lead_id;
    ELSE
      -- Create a new lead from guest info
      INSERT INTO public.leads (
        organization_id,
        name,
        email,
        phone,
        source,
        status,
        notes
      ) VALUES (
        sync_event.organization_id,
        COALESCE(sync_event.guest_name, sync_event.title, 'Guest'),
        sync_event.guest_email,
        sync_event.guest_phone,
        COALESCE(sync_event.source_platform, 'calendar_import'),
        'converted',
        'Imported from calendar: ' || COALESCE(sync_event.calendar_name, 'Unknown calendar')
      )
      RETURNING id INTO new_lead_id;
    END IF;

    -- Create the booking
    INSERT INTO public.bookings (
      organization_id,
      room_unit_id,
      lead_id,
      check_in,
      check_out,
      guest_count,
      status,
      calendar_event_id,
      notes
    ) VALUES (
      sync_event.organization_id,
      sync_event.room_unit_id,
      new_lead_id,
      sync_event.start_time::date,
      sync_event.end_time::date,
      COALESCE(sync_event.guest_count, 1),
      CASE 
        WHEN sync_event.status = 'confirmed' THEN 'confirmed'
        WHEN sync_event.status = 'cancelled' THEN 'cancelled'
        ELSE 'pending'
      END,
      sync_event.google_event_id,
      COALESCE(sync_event.raw_description, sync_event.title)
    )
    ON CONFLICT DO NOTHING;

  END LOOP;
END $$;