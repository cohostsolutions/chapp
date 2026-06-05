CREATE TABLE IF NOT EXISTS public.deleted_booking_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL,
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 hours'),
  booking_data jsonb NOT NULL,
  lead_data jsonb,
  was_lead_deleted boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_deleted_booking_archives_org_expires
ON public.deleted_booking_archives(organization_id, expires_at);

ALTER TABLE public.deleted_booking_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view deleted booking archives in their organization" ON public.deleted_booking_archives;
CREATE POLICY "Users view deleted booking archives in their organization"
ON public.deleted_booking_archives
FOR SELECT
USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users create deleted booking archives in their organization" ON public.deleted_booking_archives;
CREATE POLICY "Users create deleted booking archives in their organization"
ON public.deleted_booking_archives
FOR INSERT
WITH CHECK (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users delete deleted booking archives in their organization" ON public.deleted_booking_archives;
CREATE POLICY "Users delete deleted booking archives in their organization"
ON public.deleted_booking_archives
FOR DELETE
USING (organization_id = get_user_org(auth.uid()));

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

  IF v_lead.id IS NOT NULL AND v_other_bookings = 0 THEN
    DELETE FROM public.leads WHERE id = v_lead.id;
  END IF;

  RETURN v_archive_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_deleted_booking_archive(_archive_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_archive public.deleted_booking_archives%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_lead public.leads%ROWTYPE;
  v_org_id uuid;
BEGIN
  v_org_id := get_user_org(auth.uid());

  SELECT * INTO v_archive
  FROM public.deleted_booking_archives
  WHERE id = _archive_id
    AND organization_id = v_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deleted booking archive not found';
  END IF;

  IF v_archive.expires_at <= now() THEN
    DELETE FROM public.deleted_booking_archives WHERE id = _archive_id;
    RAISE EXCEPTION 'Recovery window has expired';
  END IF;

  v_booking := jsonb_populate_record(NULL::public.bookings, v_archive.booking_data);

  IF EXISTS (SELECT 1 FROM public.bookings WHERE id = v_booking.id) THEN
    RAISE EXCEPTION 'Booking already exists';
  END IF;

  IF v_archive.was_lead_deleted AND v_archive.lead_data IS NOT NULL THEN
    v_lead := jsonb_populate_record(NULL::public.leads, v_archive.lead_data);

    IF NOT EXISTS (SELECT 1 FROM public.leads WHERE id = v_lead.id) THEN
      INSERT INTO public.leads SELECT (v_lead).*;
    END IF;
  END IF;

  INSERT INTO public.bookings SELECT (v_booking).*;

  DELETE FROM public.deleted_booking_archives WHERE id = _archive_id;

  RETURN v_booking.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_tracking_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.login_attempts
  WHERE attempted_at < NOW() - INTERVAL '90 days';

  DELETE FROM public.analytics_events
  WHERE created_at < NOW() - INTERVAL '30 days';

  DELETE FROM public.deleted_booking_archives
  WHERE expires_at < NOW();

  RAISE NOTICE 'Cleanup completed at %', NOW();
END;
$$;