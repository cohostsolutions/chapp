begin;

create or replace function public.get_asset_migration_preview(
  p_source_org_id uuid,
  p_preview_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  v_limit integer := greatest(coalesce(p_preview_limit, 500), 1);
  v_preview jsonb;
begin
  if current_user_id is null or not public.has_role(current_user_id, 'super_admin'::public.app_role) then
    raise exception 'Access denied';
  end if;

  if not exists (select 1 from public.organizations where id = p_source_org_id) then
    raise exception 'Source organization not found';
  end if;

  select jsonb_build_object(
    'categories',
    coalesce(
      jsonb_agg(category order by sort_order) filter (where jsonb_array_length(category->'items') > 0),
      '[]'::jsonb
    )
  )
  into v_preview
  from (
    select 1 as sort_order, jsonb_build_object(
      'key', 'leads',
      'label', 'Leads',
      'totalCount', (select count(*) from public.leads where organization_id = p_source_org_id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'name', name,
          'subtitle', coalesce(email, 'No email'),
          'status', status
        ) order by created_at desc)
        from (
          select id, name, email, status, created_at
          from public.leads
          where organization_id = p_source_org_id
          order by created_at desc
          limit v_limit
        ) leads_preview
      ), '[]'::jsonb)
    ) as category
    union all
    select 2, jsonb_build_object(
      'key', 'platforms',
      'label', 'Social Platforms',
      'totalCount', (select count(*) from public.social_platforms where organization_id = p_source_org_id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'name', display_name,
          'subtitle', platform,
          'status', case when is_enabled then 'Active' else 'Disabled' end
        ) order by display_name)
        from (
          select id, display_name, platform, is_enabled
          from public.social_platforms
          where organization_id = p_source_org_id
          order by display_name
          limit v_limit
        ) platform_preview
      ), '[]'::jsonb)
    )
    union all
    select 3, jsonb_build_object(
      'key', 'bookings',
      'label', 'Bookings',
      'relatedTo', 'leads',
      'totalCount', (select count(*) from public.bookings where organization_id = p_source_org_id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'name', 'Booking ' || left(id::text, 8),
          'subtitle', to_char(check_in, 'YYYY-MM-DD') || ' - ' || to_char(check_out, 'YYYY-MM-DD'),
          'status', status
        ) order by check_in desc)
        from (
          select id, check_in, check_out, status
          from public.bookings
          where organization_id = p_source_org_id
          order by check_in desc
          limit v_limit
        ) bookings_preview
      ), '[]'::jsonb)
    )
    union all
    select 4, jsonb_build_object(
      'key', 'orders',
      'label', 'Orders',
      'relatedTo', 'leads',
      'totalCount', (select count(*) from public.orders where organization_id = p_source_org_id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'name', 'Order ' || left(id::text, 8),
          'subtitle', case when total_amount is not null then '$' || total_amount::text else 'No amount' end,
          'status', status
        ) order by pickup_time desc nulls last)
        from (
          select id, total_amount, status, pickup_time
          from public.orders
          where organization_id = p_source_org_id
          order by pickup_time desc nulls last
          limit v_limit
        ) orders_preview
      ), '[]'::jsonb)
    )
    union all
    select 5, jsonb_build_object(
      'key', 'offerings',
      'label', 'Offerings/Menu Items',
      'totalCount', (select count(*) from public.offerings where organization_id = p_source_org_id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'name', name,
          'subtitle', coalesce(category, 'No category'),
          'status', case when is_active then 'Active' else 'Inactive' end
        ) order by name)
        from (
          select id, name, category, is_active
          from public.offerings
          where organization_id = p_source_org_id
          order by name
          limit v_limit
        ) offerings_preview
      ), '[]'::jsonb)
    )
    union all
    select 6, jsonb_build_object(
      'key', 'room_units',
      'label', 'Room Units',
      'totalCount', (select count(*) from public.room_units where organization_id = p_source_org_id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'name', name,
          'subtitle', coalesce(category, 'No category'),
          'status', case when is_active then 'Active' else 'Inactive' end
        ) order by name)
        from (
          select id, name, category, is_active
          from public.room_units
          where organization_id = p_source_org_id
          order by name
          limit v_limit
        ) room_units_preview
      ), '[]'::jsonb)
    )
    union all
    select 7, jsonb_build_object(
      'key', 'knowledge_entries',
      'label', 'Knowledge Base Entries',
      'totalCount', (select count(*) from public.knowledge_base_entries where organization_id = p_source_org_id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'name', title,
          'subtitle', coalesce(category, 'No category'),
          'status', case when is_active then 'Active' else 'Inactive' end
        ) order by title)
        from (
          select id, title, category, is_active
          from public.knowledge_base_entries
          where organization_id = p_source_org_id
          order by title
          limit v_limit
        ) knowledge_entries_preview
      ), '[]'::jsonb)
    )
    union all
    select 8, jsonb_build_object(
      'key', 'knowledge_docs',
      'label', 'Knowledge Base Documents',
      'totalCount', (select count(*) from public.knowledge_base_documents where organization_id = p_source_org_id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'name', file_name,
          'subtitle', file_type,
          'status', status
        ) order by file_name)
        from (
          select id, file_name, file_type, status
          from public.knowledge_base_documents
          where organization_id = p_source_org_id
          order by file_name
          limit v_limit
        ) knowledge_docs_preview
      ), '[]'::jsonb)
    )
    union all
    select 9, jsonb_build_object(
      'key', 'reports',
      'label', 'Reports',
      'totalCount', (select count(*) from public.reports where organization_id = p_source_org_id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'name', name,
          'subtitle', report_type,
          'status', case when is_scheduled then 'Scheduled' else 'Manual' end
        ) order by name)
        from (
          select id, name, report_type, is_scheduled
          from public.reports
          where organization_id = p_source_org_id
          order by name
          limit v_limit
        ) reports_preview
      ), '[]'::jsonb)
    )
    union all
    select 10, jsonb_build_object(
      'key', 'workflows',
      'label', 'Workflows',
      'totalCount', (select count(*) from public.workflows where organization_id = p_source_org_id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'name', name,
          'subtitle', trigger_type,
          'status', case when is_active then 'Active' else 'Inactive' end
        ) order by name)
        from (
          select id, name, trigger_type, is_active
          from public.workflows
          where organization_id = p_source_org_id
          order by name
          limit v_limit
        ) workflows_preview
      ), '[]'::jsonb)
    )
    union all
    select 11, jsonb_build_object(
      'key', 'calendar_events',
      'label', 'Calendar Events',
      'totalCount', (select count(*) from public.calendar_events where organization_id = p_source_org_id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'name', title,
          'subtitle', to_char(start_time, 'YYYY-MM-DD'),
          'status', coalesce(event_type, 'Event')
        ) order by start_time desc)
        from (
          select id, title, start_time, event_type
          from public.calendar_events
          where organization_id = p_source_org_id
          order by start_time desc
          limit v_limit
        ) calendar_preview
      ), '[]'::jsonb)
    )
    union all
    select 12, jsonb_build_object(
      'key', 'communications',
      'label', 'Communications',
      'relatedTo', 'leads',
      'totalCount', (select count(*) from public.communications where organization_id = p_source_org_id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'name', coalesce(subject, channel || ' ' || direction),
          'subtitle', to_char(created_at, 'YYYY-MM-DD'),
          'status', channel
        ) order by created_at desc)
        from (
          select id, subject, channel, direction, created_at
          from public.communications
          where organization_id = p_source_org_id
          order by created_at desc
          limit v_limit
        ) communications_preview
      ), '[]'::jsonb)
    )
    union all
    select 13, jsonb_build_object(
      'key', 'message_templates',
      'label', 'Message Templates',
      'totalCount', (select count(*) from public.message_templates where organization_id = p_source_org_id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'name', name,
          'subtitle', channel,
          'status', case when is_active then 'Active' else 'Inactive' end
        ) order by name)
        from (
          select id, name, channel, is_active
          from public.message_templates
          where organization_id = p_source_org_id
          order by name
          limit v_limit
        ) message_templates_preview
      ), '[]'::jsonb)
    )
    union all
    select 14, jsonb_build_object(
      'key', 'training_modules',
      'label', 'Training Modules',
      'totalCount', (select count(*) from public.training_modules where organization_id = p_source_org_id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'name', title,
          'subtitle', coalesce(difficulty, 'Unknown'),
          'status', visibility
        ) order by title)
        from (
          select id, title, difficulty, visibility
          from public.training_modules
          where organization_id = p_source_org_id
          order by title
          limit v_limit
        ) training_modules_preview
      ), '[]'::jsonb)
    )
    union all
    select 15, jsonb_build_object(
      'key', 'team_chats',
      'label', 'Team Chats',
      'totalCount', (select count(*) from public.team_chats where organization_id = p_source_org_id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'name', coalesce(name, 'Direct Message'),
          'subtitle', chat_type,
          'status', chat_type
        ) order by created_at desc)
        from (
          select id, name, chat_type, created_at
          from public.team_chats
          where organization_id = p_source_org_id
          order by created_at desc
          limit v_limit
        ) team_chats_preview
      ), '[]'::jsonb)
    )
    union all
    select 16, jsonb_build_object(
      'key', 'ai_conversations',
      'label', 'AI Conversations',
      'relatedTo', 'leads',
      'totalCount', (select count(*) from public.ai_conversations where organization_id = p_source_org_id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'name', 'Conversation ' || left(id::text, 8),
          'subtitle', to_char(started_at, 'YYYY-MM-DD'),
          'status', status
        ) order by started_at desc)
        from (
          select id, started_at, status
          from public.ai_conversations
          where organization_id = p_source_org_id
          order by started_at desc
          limit v_limit
        ) ai_conversations_preview
      ), '[]'::jsonb)
    )
    union all
    select 17, jsonb_build_object(
      'key', 'agent_priorities',
      'label', 'Agent Priorities',
      'totalCount', (select count(*) from public.agent_priorities where organization_id = p_source_org_id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'name', 'Priority ' || priority::text,
          'subtitle', 'Agent ' || left(agent_id::text, 8),
          'status', case when is_available then 'Available' else 'Unavailable' end
        ) order by priority asc)
        from (
          select id, priority, agent_id, is_available
          from public.agent_priorities
          where organization_id = p_source_org_id
          order by priority asc
          limit v_limit
        ) agent_priorities_preview
      ), '[]'::jsonb)
    )
    union all
    select 18, jsonb_build_object(
      'key', 'rubric_templates',
      'label', 'Rubric Templates',
      'totalCount', (select count(*) from public.rubric_templates where organization_id = p_source_org_id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'name', name,
          'subtitle', coalesce(description, 'No description')
        ) order by name)
        from (
          select id, name, description
          from public.rubric_templates
          where organization_id = p_source_org_id
          order by name
          limit v_limit
        ) rubric_templates_preview
      ), '[]'::jsonb)
    )
  ) preview_categories;

  return v_preview;
end;
$$;

grant execute on function public.get_asset_migration_preview(uuid, integer) to authenticated;

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
  v_ids text[];
  v_count int;
  v_category text;
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
    if jsonb_typeof(p_assets -> v_category) <> 'array' then
      raise exception 'Invalid asset list for category: %', v_category;
    end if;

    select coalesce(array_agg(value), array[]::text[])
    into v_ids
    from jsonb_array_elements_text(p_assets -> v_category);

    if coalesce(array_length(v_ids, 1), 0) = 0 then
      continue;
    end if;

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

    v_uuid_ids := array(select elem::uuid from unnest(v_ids) as elem);

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