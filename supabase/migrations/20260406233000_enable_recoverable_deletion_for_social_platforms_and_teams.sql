CREATE OR REPLACE FUNCTION public.archive_record_deletion(_table_name text, _record_id uuid, _display_label text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_tables constant text[] := ARRAY[
    'pricing_market_profiles',
    'booking_templates',
    'filter_presets',
    'maintenance_blocks',
    'message_templates',
    'orders',
    'reports',
    'social_platforms',
    'teams',
    'workflows'
  ];
  v_record_data jsonb;
  v_organization_id uuid;
  v_archive_id uuid;
BEGIN
  IF NOT (_table_name = ANY(v_allowed_tables)) THEN
    RAISE EXCEPTION 'Table % is not enabled for recoverable deletion', _table_name;
  END IF;

  EXECUTE format(
    'SELECT to_jsonb(t), t.organization_id FROM public.%I t WHERE t.id = $1 AND t.organization_id = $2',
    _table_name
  )
  INTO v_record_data, v_organization_id
  USING _record_id, get_user_org(auth.uid());

  IF v_record_data IS NULL THEN
    RAISE EXCEPTION 'Record not found or not accessible';
  END IF;

  INSERT INTO public.deleted_record_archives (
    organization_id,
    table_name,
    record_id,
    deleted_by,
    display_label,
    record_data
  ) VALUES (
    v_organization_id,
    _table_name,
    _record_id,
    auth.uid(),
    _display_label,
    v_record_data
  )
  RETURNING id INTO v_archive_id;

  EXECUTE format('DELETE FROM public.%I WHERE id = $1 AND organization_id = $2', _table_name)
  USING _record_id, v_organization_id;

  RETURN v_archive_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_deleted_record_archive(_archive_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_tables constant text[] := ARRAY[
    'pricing_market_profiles',
    'booking_templates',
    'filter_presets',
    'maintenance_blocks',
    'message_templates',
    'orders',
    'reports',
    'social_platforms',
    'teams',
    'workflows'
  ];
  v_archive public.deleted_record_archives%ROWTYPE;
BEGIN
  SELECT * INTO v_archive
  FROM public.deleted_record_archives
  WHERE id = _archive_id
    AND organization_id = get_user_org(auth.uid());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deleted archive not found';
  END IF;

  IF NOT (v_archive.table_name = ANY(v_allowed_tables)) THEN
    RAISE EXCEPTION 'Table % is not enabled for recoverable restore', v_archive.table_name;
  END IF;

  IF v_archive.expires_at <= now() THEN
    DELETE FROM public.deleted_record_archives WHERE id = _archive_id;
    RAISE EXCEPTION 'Recovery window has expired';
  END IF;

  EXECUTE format(
    'INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)',
    v_archive.table_name,
    v_archive.table_name
  ) USING v_archive.record_data;

  DELETE FROM public.deleted_record_archives WHERE id = _archive_id;

  RETURN v_archive.record_id;
END;
$$;