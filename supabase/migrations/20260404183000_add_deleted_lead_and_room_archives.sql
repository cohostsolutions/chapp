CREATE TABLE IF NOT EXISTS public.deleted_lead_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL,
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 hours'),
  lead_data jsonb NOT NULL,
  bookings_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  orders_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_conversations_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_messages_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  conversation_metadata_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  chat_messages_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  call_logs_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  communications_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  lead_offerings_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  lead_engagement_profiles_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  lead_qualification_scores_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  qualification_events_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  re_engagement_campaigns_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  handoff_events_data jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.deleted_room_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  room_id uuid NOT NULL,
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 hours'),
  room_data jsonb NOT NULL,
  bookings_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  maintenance_blocks_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  calendar_sync_events_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  operational_expense_links_data jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_deleted_lead_archives_org_expires
ON public.deleted_lead_archives(organization_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_deleted_room_archives_org_expires
ON public.deleted_room_archives(organization_id, expires_at);

ALTER TABLE public.deleted_lead_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_room_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view deleted lead archives in their organization" ON public.deleted_lead_archives;
CREATE POLICY "Users view deleted lead archives in their organization"
ON public.deleted_lead_archives
FOR SELECT
USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users create deleted lead archives in their organization" ON public.deleted_lead_archives;
CREATE POLICY "Users create deleted lead archives in their organization"
ON public.deleted_lead_archives
FOR INSERT
WITH CHECK (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users delete deleted lead archives in their organization" ON public.deleted_lead_archives;
CREATE POLICY "Users delete deleted lead archives in their organization"
ON public.deleted_lead_archives
FOR DELETE
USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users view deleted room archives in their organization" ON public.deleted_room_archives;
CREATE POLICY "Users view deleted room archives in their organization"
ON public.deleted_room_archives
FOR SELECT
USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users create deleted room archives in their organization" ON public.deleted_room_archives;
CREATE POLICY "Users create deleted room archives in their organization"
ON public.deleted_room_archives
FOR INSERT
WITH CHECK (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users delete deleted room archives in their organization" ON public.deleted_room_archives;
CREATE POLICY "Users delete deleted room archives in their organization"
ON public.deleted_room_archives
FOR DELETE
USING (organization_id = get_user_org(auth.uid()));

CREATE OR REPLACE FUNCTION public.archive_lead_deletion(_lead_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_archive_id uuid;
  v_conversation_ids uuid[];
BEGIN
  SELECT * INTO v_lead
  FROM public.leads
  WHERE id = _lead_id
    AND organization_id = get_user_org(auth.uid());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found or not accessible';
  END IF;

  SELECT array_agg(id) INTO v_conversation_ids
  FROM public.ai_conversations
  WHERE lead_id = _lead_id;

  INSERT INTO public.deleted_lead_archives (
    organization_id,
    lead_id,
    deleted_by,
    lead_data,
    bookings_data,
    orders_data,
    ai_conversations_data,
    ai_messages_data,
    conversation_metadata_data,
    chat_messages_data,
    call_logs_data,
    communications_data,
    lead_offerings_data,
    lead_engagement_profiles_data,
    lead_qualification_scores_data,
    qualification_events_data,
    re_engagement_campaigns_data,
    handoff_events_data
  ) VALUES (
    v_lead.organization_id,
    v_lead.id,
    auth.uid(),
    to_jsonb(v_lead),
    COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM public.bookings b WHERE b.lead_id = _lead_id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(o)) FROM public.orders o WHERE o.lead_id = _lead_id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM public.ai_conversations c WHERE c.lead_id = _lead_id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM public.ai_messages m WHERE v_conversation_ids IS NOT NULL AND m.conversation_id = ANY(v_conversation_ids)), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(cm)) FROM public.conversation_metadata cm WHERE cm.lead_id = _lead_id OR (v_conversation_ids IS NOT NULL AND cm.conversation_id = ANY(v_conversation_ids))), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(cm)) FROM public.chat_messages cm WHERE cm.lead_id = _lead_id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(cl)) FROM public.call_logs cl WHERE cl.lead_id = _lead_id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(cn)) FROM public.communications cn WHERE cn.lead_id = _lead_id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(lo)) FROM public.lead_offerings lo WHERE lo.lead_id = _lead_id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(ep)) FROM public.lead_engagement_profiles ep WHERE ep.lead_id = _lead_id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(qs)) FROM public.lead_qualification_scores qs WHERE qs.lead_id = _lead_id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(qe)) FROM public.qualification_events qe WHERE qe.lead_id = _lead_id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(rc)) FROM public.re_engagement_campaigns rc WHERE rc.lead_id = _lead_id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(he)) FROM public.handoff_events he WHERE he.lead_id = _lead_id), '[]'::jsonb)
  ) RETURNING id INTO v_archive_id;

  DELETE FROM public.leads WHERE id = _lead_id;

  RETURN v_archive_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_deleted_lead_archive(_archive_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_archive public.deleted_lead_archives%ROWTYPE;
  v_lead public.leads%ROWTYPE;
BEGIN
  SELECT * INTO v_archive
  FROM public.deleted_lead_archives
  WHERE id = _archive_id
    AND organization_id = get_user_org(auth.uid());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deleted lead archive not found';
  END IF;

  IF v_archive.expires_at <= now() THEN
    DELETE FROM public.deleted_lead_archives WHERE id = _archive_id;
    RAISE EXCEPTION 'Recovery window has expired';
  END IF;

  v_lead := jsonb_populate_record(NULL::public.leads, v_archive.lead_data);
  INSERT INTO public.leads SELECT (v_lead).*;

  INSERT INTO public.ai_conversations SELECT * FROM jsonb_populate_recordset(NULL::public.ai_conversations, v_archive.ai_conversations_data);
  INSERT INTO public.ai_messages SELECT * FROM jsonb_populate_recordset(NULL::public.ai_messages, v_archive.ai_messages_data);
  INSERT INTO public.conversation_metadata SELECT * FROM jsonb_populate_recordset(NULL::public.conversation_metadata, v_archive.conversation_metadata_data);
  INSERT INTO public.chat_messages SELECT * FROM jsonb_populate_recordset(NULL::public.chat_messages, v_archive.chat_messages_data);
  INSERT INTO public.call_logs SELECT * FROM jsonb_populate_recordset(NULL::public.call_logs, v_archive.call_logs_data);
  INSERT INTO public.communications SELECT * FROM jsonb_populate_recordset(NULL::public.communications, v_archive.communications_data);
  INSERT INTO public.lead_offerings SELECT * FROM jsonb_populate_recordset(NULL::public.lead_offerings, v_archive.lead_offerings_data);
  INSERT INTO public.lead_engagement_profiles SELECT * FROM jsonb_populate_recordset(NULL::public.lead_engagement_profiles, v_archive.lead_engagement_profiles_data);
  INSERT INTO public.lead_qualification_scores SELECT * FROM jsonb_populate_recordset(NULL::public.lead_qualification_scores, v_archive.lead_qualification_scores_data);
  INSERT INTO public.qualification_events SELECT * FROM jsonb_populate_recordset(NULL::public.qualification_events, v_archive.qualification_events_data);
  INSERT INTO public.re_engagement_campaigns SELECT * FROM jsonb_populate_recordset(NULL::public.re_engagement_campaigns, v_archive.re_engagement_campaigns_data);
  INSERT INTO public.handoff_events SELECT * FROM jsonb_populate_recordset(NULL::public.handoff_events, v_archive.handoff_events_data);
  INSERT INTO public.bookings SELECT * FROM jsonb_populate_recordset(NULL::public.bookings, v_archive.bookings_data);
  INSERT INTO public.orders SELECT * FROM jsonb_populate_recordset(NULL::public.orders, v_archive.orders_data);

  DELETE FROM public.deleted_lead_archives WHERE id = _archive_id;

  RETURN v_archive.lead_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_room_deletion(_room_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.room_units%ROWTYPE;
  v_archive_id uuid;
BEGIN
  SELECT * INTO v_room
  FROM public.room_units
  WHERE id = _room_id
    AND organization_id = get_user_org(auth.uid());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found or not accessible';
  END IF;

  INSERT INTO public.deleted_room_archives (
    organization_id,
    room_id,
    deleted_by,
    room_data,
    bookings_data,
    maintenance_blocks_data,
    calendar_sync_events_data,
    operational_expense_links_data
  ) VALUES (
    v_room.organization_id,
    v_room.id,
    auth.uid(),
    to_jsonb(v_room),
    COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM public.bookings b WHERE b.room_unit_id = _room_id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(mb)) FROM public.maintenance_blocks mb WHERE mb.room_unit_id = _room_id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(cse)) FROM public.calendar_sync_events cse WHERE cse.room_unit_id = _room_id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', oe.id, 'room_unit_id', oe.room_unit_id)) FROM public.operational_expenses oe WHERE oe.room_unit_id = _room_id), '[]'::jsonb)
  ) RETURNING id INTO v_archive_id;

  DELETE FROM public.room_units WHERE id = _room_id;

  RETURN v_archive_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_deleted_room_archive(_archive_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_archive public.deleted_room_archives%ROWTYPE;
  v_room public.room_units%ROWTYPE;
  v_expense_link record;
BEGIN
  SELECT * INTO v_archive
  FROM public.deleted_room_archives
  WHERE id = _archive_id
    AND organization_id = get_user_org(auth.uid());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deleted room archive not found';
  END IF;

  IF v_archive.expires_at <= now() THEN
    DELETE FROM public.deleted_room_archives WHERE id = _archive_id;
    RAISE EXCEPTION 'Recovery window has expired';
  END IF;

  v_room := jsonb_populate_record(NULL::public.room_units, v_archive.room_data);
  INSERT INTO public.room_units SELECT (v_room).*;

  INSERT INTO public.maintenance_blocks SELECT * FROM jsonb_populate_recordset(NULL::public.maintenance_blocks, v_archive.maintenance_blocks_data);
  INSERT INTO public.calendar_sync_events SELECT * FROM jsonb_populate_recordset(NULL::public.calendar_sync_events, v_archive.calendar_sync_events_data);
  INSERT INTO public.bookings SELECT * FROM jsonb_populate_recordset(NULL::public.bookings, v_archive.bookings_data);

  FOR v_expense_link IN SELECT * FROM jsonb_to_recordset(v_archive.operational_expense_links_data) AS x(id uuid, room_unit_id uuid)
  LOOP
    UPDATE public.operational_expenses
    SET room_unit_id = v_expense_link.room_unit_id
    WHERE id = v_expense_link.id;
  END LOOP;

  DELETE FROM public.deleted_room_archives WHERE id = _archive_id;

  RETURN v_archive.room_id;
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

  DELETE FROM public.deleted_record_archives
  WHERE expires_at < NOW();

  DELETE FROM public.deleted_lead_archives
  WHERE expires_at < NOW();

  DELETE FROM public.deleted_room_archives
  WHERE expires_at < NOW();

  RAISE NOTICE 'Cleanup completed at %', NOW();
END;
$$;