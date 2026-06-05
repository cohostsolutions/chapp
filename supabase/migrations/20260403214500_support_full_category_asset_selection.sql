begin;

create or replace function public.migrate_assets_atomic(
  p_source_org_id uuid,
  p_target_org_id uuid,
  p_assets jsonb,
  p_performed_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb := '{}';
  v_migration_id uuid;
  v_table_name text;
  v_count int;
  v_category text;
  v_asset_spec jsonb;
  v_uuid_ids uuid[];
begin
  if p_source_org_id = p_target_org_id then
    raise exception 'Source and target organizations must be different';
  end if;

  if not exists (select 1 from public.organizations where id = p_source_org_id) then
    raise exception 'Source organization not found';
  end if;

  if not exists (select 1 from public.organizations where id = p_target_org_id) then
    raise exception 'Target organization not found';
  end if;

  insert into public.migration_logs (
    performed_by,
    source_organization_id,
    target_organization_id,
    can_undo_until
  ) values (
    p_performed_by,
    p_source_org_id,
    p_target_org_id,
    now() + interval '60 seconds'
  ) returning id into v_migration_id;

  for v_category in
    select jsonb_object_keys(p_assets)
  loop
    v_table_name := case v_category
      when 'leads' then 'leads'
      when 'platforms' then 'social_platforms'
      when 'bookings' then 'bookings'
      when 'orders' then 'orders'
      when 'offerings' then 'offerings'
      when 'room_units' then 'room_units'
      when 'knowledge_entries' then 'knowledge_base_entries'
      when 'knowledge_docs' then 'knowledge_base_documents'
      when 'reports' then 'reports'
      when 'workflows' then 'workflows'
      when 'calendar_events' then 'calendar_events'
      when 'communications' then 'communications'
      when 'message_templates' then 'message_templates'
      when 'training_modules' then 'training_modules'
      when 'team_chats' then 'team_chats'
      when 'ai_conversations' then 'ai_conversations'
      when 'agent_priorities' then 'agent_priorities'
      when 'rubric_templates' then 'rubric_templates'
      else null
    end;

    if v_table_name is null then
      raise exception 'Invalid asset category: %', v_category;
    end if;

    v_asset_spec := p_assets -> v_category;
    v_uuid_ids := array[]::uuid[];

    if jsonb_typeof(v_asset_spec) = 'array' then
      select coalesce(array_agg(value::uuid), array[]::uuid[])
      into v_uuid_ids
      from jsonb_array_elements_text(v_asset_spec);
    elsif jsonb_typeof(v_asset_spec) = 'object' then
      if coalesce(v_asset_spec ->> 'mode', '') = 'all' then
        execute format(
          'select coalesce(array_agg(id), array[]::uuid[]) from %I where organization_id = $1',
          v_table_name
        ) into v_uuid_ids using p_source_org_id;
      elsif coalesce(v_asset_spec ->> 'mode', '') = 'ids' and jsonb_typeof(v_asset_spec -> 'ids') = 'array' then
        select coalesce(array_agg(value::uuid), array[]::uuid[])
        into v_uuid_ids
        from jsonb_array_elements_text(v_asset_spec -> 'ids');
      else
        raise exception 'Invalid asset selection for category: %', v_category;
      end if;
    else
      raise exception 'Invalid asset list for category: %', v_category;
    end if;

    if coalesce(array_length(v_uuid_ids, 1), 0) = 0 then
      continue;
    end if;

    execute format(
      'update %I set organization_id = $1 where organization_id = $2 and id = any($3::uuid[])',
      v_table_name
    ) using p_target_org_id, p_source_org_id, v_uuid_ids;

    get diagnostics v_count = row_count;

    execute format(
      'update public.migration_logs set %I = $1 where id = $2',
      'migrated_' || v_category
    ) using to_jsonb(v_uuid_ids), v_migration_id;

    v_result := jsonb_set(v_result, array[v_category], to_jsonb(v_count));
  end loop;

  return jsonb_build_object(
    'migration_id', v_migration_id,
    'counts', v_result
  );
exception
  when others then
    raise exception 'Migration failed: %', sqlerrm;
end;
$$;

grant execute on function public.migrate_assets_atomic(uuid, uuid, jsonb, uuid) to authenticated;

commit;