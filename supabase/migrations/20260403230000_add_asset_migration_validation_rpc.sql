begin;

create or replace function public.validate_asset_migration_plan(
  p_source_org_id uuid,
  p_assets jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  selected_lead_ids uuid[] := array[]::uuid[];
  warnings jsonb := '[]'::jsonb;
  missing_booking_refs integer := 0;
  missing_order_refs integer := 0;
  missing_communication_refs integer := 0;
  missing_conversation_refs integer := 0;
begin
  if current_user_id is null or not public.has_role(current_user_id, 'super_admin'::public.app_role) then
    raise exception 'Access denied';
  end if;

  if not exists (select 1 from public.organizations where id = p_source_org_id) then
    raise exception 'Source organization not found';
  end if;

  if p_assets ? 'leads' then
    if jsonb_typeof(p_assets -> 'leads') = 'object' and coalesce(p_assets -> 'leads' ->> 'mode', '') = 'all' then
      select coalesce(array_agg(id), array[]::uuid[])
      into selected_lead_ids
      from public.leads
      where organization_id = p_source_org_id;
    elsif jsonb_typeof(p_assets -> 'leads') = 'object' and coalesce(p_assets -> 'leads' ->> 'mode', '') = 'ids' then
      select coalesce(array_agg(value::uuid), array[]::uuid[])
      into selected_lead_ids
      from jsonb_array_elements_text(p_assets -> 'leads' -> 'ids');
    elsif jsonb_typeof(p_assets -> 'leads') = 'array' then
      select coalesce(array_agg(value::uuid), array[]::uuid[])
      into selected_lead_ids
      from jsonb_array_elements_text(p_assets -> 'leads');
    end if;
  end if;

  if p_assets ? 'bookings' then
    if coalesce(array_length(selected_lead_ids, 1), 0) = 0 then
      warnings := warnings || jsonb_build_array(jsonb_build_object(
        'category', 'Bookings',
        'issue', 'Bookings reference leads. Select the related leads or choose all leads before migrating bookings.',
        'severity', 'error'
      ));
    else
      with selected_bookings as (
        select b.id, b.lead_id
        from public.bookings b
        where b.organization_id = p_source_org_id
          and (
            (jsonb_typeof(p_assets -> 'bookings') = 'object' and coalesce(p_assets -> 'bookings' ->> 'mode', '') = 'all')
            or b.id = any(
              coalesce(
                array(select value::uuid from jsonb_array_elements_text(
                  case
                    when jsonb_typeof(p_assets -> 'bookings') = 'object' then p_assets -> 'bookings' -> 'ids'
                    else p_assets -> 'bookings'
                  end
                )),
                array[]::uuid[]
              )
            )
          )
      )
      select count(*) into missing_booking_refs
      from selected_bookings
      where lead_id is not null
        and not (lead_id = any(selected_lead_ids));

      if missing_booking_refs > 0 then
        warnings := warnings || jsonb_build_array(jsonb_build_object(
          'category', 'Bookings',
          'issue', format('%s selected booking(s) reference leads that are not included in this migration.', missing_booking_refs),
          'severity', 'error'
        ));
      end if;
    end if;
  end if;

  if p_assets ? 'orders' then
    if coalesce(array_length(selected_lead_ids, 1), 0) = 0 then
      warnings := warnings || jsonb_build_array(jsonb_build_object(
        'category', 'Orders',
        'issue', 'Orders reference leads. Select the related leads or choose all leads before migrating orders.',
        'severity', 'error'
      ));
    else
      with selected_orders as (
        select o.id, o.lead_id
        from public.orders o
        where o.organization_id = p_source_org_id
          and (
            (jsonb_typeof(p_assets -> 'orders') = 'object' and coalesce(p_assets -> 'orders' ->> 'mode', '') = 'all')
            or o.id = any(
              coalesce(
                array(select value::uuid from jsonb_array_elements_text(
                  case
                    when jsonb_typeof(p_assets -> 'orders') = 'object' then p_assets -> 'orders' -> 'ids'
                    else p_assets -> 'orders'
                  end
                )),
                array[]::uuid[]
              )
            )
          )
      )
      select count(*) into missing_order_refs
      from selected_orders
      where lead_id is not null
        and not (lead_id = any(selected_lead_ids));

      if missing_order_refs > 0 then
        warnings := warnings || jsonb_build_array(jsonb_build_object(
          'category', 'Orders',
          'issue', format('%s selected order(s) reference leads that are not included in this migration.', missing_order_refs),
          'severity', 'error'
        ));
      end if;
    end if;
  end if;

  if p_assets ? 'communications' then
    if coalesce(array_length(selected_lead_ids, 1), 0) = 0 then
      warnings := warnings || jsonb_build_array(jsonb_build_object(
        'category', 'Communications',
        'issue', 'Lead-linked communications require their related leads to be included in the migration.',
        'severity', 'error'
      ));
    else
      with selected_communications as (
        select c.id, c.lead_id
        from public.communications c
        where c.organization_id = p_source_org_id
          and (
            (jsonb_typeof(p_assets -> 'communications') = 'object' and coalesce(p_assets -> 'communications' ->> 'mode', '') = 'all')
            or c.id = any(
              coalesce(
                array(select value::uuid from jsonb_array_elements_text(
                  case
                    when jsonb_typeof(p_assets -> 'communications') = 'object' then p_assets -> 'communications' -> 'ids'
                    else p_assets -> 'communications'
                  end
                )),
                array[]::uuid[]
              )
            )
          )
      )
      select count(*) into missing_communication_refs
      from selected_communications
      where lead_id is not null
        and not (lead_id = any(selected_lead_ids));

      if missing_communication_refs > 0 then
        warnings := warnings || jsonb_build_array(jsonb_build_object(
          'category', 'Communications',
          'issue', format('%s selected communication(s) reference leads that are not included in this migration.', missing_communication_refs),
          'severity', 'error'
        ));
      end if;
    end if;
  end if;

  if p_assets ? 'ai_conversations' then
    if coalesce(array_length(selected_lead_ids, 1), 0) = 0 then
      warnings := warnings || jsonb_build_array(jsonb_build_object(
        'category', 'AI Conversations',
        'issue', 'AI conversations tied to leads require those leads to be included in the migration.',
        'severity', 'error'
      ));
    else
      with selected_conversations as (
        select a.id, a.lead_id
        from public.ai_conversations a
        where a.organization_id = p_source_org_id
          and (
            (jsonb_typeof(p_assets -> 'ai_conversations') = 'object' and coalesce(p_assets -> 'ai_conversations' ->> 'mode', '') = 'all')
            or a.id = any(
              coalesce(
                array(select value::uuid from jsonb_array_elements_text(
                  case
                    when jsonb_typeof(p_assets -> 'ai_conversations') = 'object' then p_assets -> 'ai_conversations' -> 'ids'
                    else p_assets -> 'ai_conversations'
                  end
                )),
                array[]::uuid[]
              )
            )
          )
      )
      select count(*) into missing_conversation_refs
      from selected_conversations
      where lead_id is not null
        and not (lead_id = any(selected_lead_ids));

      if missing_conversation_refs > 0 then
        warnings := warnings || jsonb_build_array(jsonb_build_object(
          'category', 'AI Conversations',
          'issue', format('%s selected AI conversation(s) reference leads that are not included in this migration.', missing_conversation_refs),
          'severity', 'error'
        ));
      end if;
    end if;
  end if;

  return jsonb_build_object('warnings', warnings);
end;
$$;

grant execute on function public.validate_asset_migration_plan(uuid, jsonb) to authenticated;

commit;