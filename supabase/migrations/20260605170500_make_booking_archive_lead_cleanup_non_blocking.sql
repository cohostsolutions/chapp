CREATE OR REPLACE FUNCTION public.archive_booking_deletion(_booking_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_lead public.leads%ROWTYPE;
  v_other_bookings integer;
  v_archive_id uuid;
  v_org_id uuid;
BEGIN
  v_org_id := get_user_org(auth.uid());

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = _booking_id
    AND organization_id = v_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or not accessible';
  END IF;

  IF v_booking.lead_id IS NOT NULL THEN
    SELECT * INTO v_lead
    FROM public.leads
    WHERE id = v_booking.lead_id
      AND organization_id = v_org_id;

    SELECT count(*) INTO v_other_bookings
    FROM public.bookings
    WHERE lead_id = v_booking.lead_id
      AND id <> v_booking.id;
  ELSE
    v_other_bookings := 0;
  END IF;

  INSERT INTO public.deleted_booking_archives (
    organization_id,
    booking_id,
    deleted_by,
    booking_data,
    lead_data,
    was_lead_deleted
  ) VALUES (
    v_booking.organization_id,
    v_booking.id,
    auth.uid(),
    to_jsonb(v_booking),
    CASE WHEN v_lead.id IS NOT NULL THEN to_jsonb(v_lead) ELSE NULL END,
    (v_lead.id IS NOT NULL AND v_other_bookings = 0)
  )
  RETURNING id INTO v_archive_id;

  DELETE FROM public.bookings WHERE id = v_booking.id;

  -- Do not let ancillary lead cleanup block booking deletion.
  IF v_lead.id IS NOT NULL AND v_other_bookings = 0 THEN
    BEGIN
      DELETE FROM public.leads WHERE id = v_lead.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Lead cleanup skipped for lead %: %', v_lead.id, SQLERRM;
    END;
  END IF;

  RETURN v_archive_id;
END;
$$;
