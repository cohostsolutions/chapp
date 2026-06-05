begin;

create or replace function public.get_chat_conversation_summaries(p_organization_id uuid)
returns table (
  id uuid,
  lead_id uuid,
  lead_name text,
  phone text,
  email text,
  last_message_content text,
  last_message_at timestamptz,
  last_message_direction text,
  last_message_metadata jsonb,
  unread bigint,
  channel text,
  message_count bigint,
  failed_message_count bigint,
  external_id text,
  linked_booking_id uuid,
  linked_booking_room_name text,
  linked_booking_check_in date,
  linked_booking_check_out date,
  linked_booking_status text,
  is_ai_managed boolean,
  lead_temperature text,
  conversation_status text,
  platform text,
  started_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Access denied';
  end if;

  if p_organization_id is null then
    raise exception 'Organization id is required';
  end if;

  if p_organization_id is distinct from public.get_user_org(current_user_id)
     and not public.has_role(current_user_id, 'super_admin'::public.app_role) then
    raise exception 'Access denied';
  end if;

  return query
  with scoped_communications as (
    select
      c.id,
      c.lead_id,
      c.channel,
      c.direction,
      c.content,
      c.status,
      c.metadata,
      c.created_at
    from public.communications c
    where c.organization_id = p_organization_id
      and c.lead_id is not null
  ),
  aggregated as (
    select
      c.lead_id,
      count(*)::bigint as message_count,
      count(*) filter (
        where c.direction = 'inbound'
          and c.status is distinct from 'read'
      )::bigint as unread,
      count(*) filter (
        where c.status = 'failed'
          or c.metadata ->> 'ai_send_status' = 'failed'
          or c.metadata ->> 'delivery_status' = 'failed'
      )::bigint as failed_message_count,
      min(c.created_at) as started_at
    from scoped_communications c
    group by c.lead_id
  ),
  latest_message as (
    select distinct on (c.lead_id)
      c.lead_id,
      c.content,
      c.created_at,
      c.direction,
      c.metadata,
      c.channel,
      c.id
    from scoped_communications c
    order by c.lead_id, c.created_at desc, c.id desc
  ),
  selected_ai_conversations as (
    select distinct on (ac.lead_id)
      ac.lead_id,
      ac.external_id,
      ac.status,
      ac.platform
    from public.ai_conversations ac
    join latest_message lm on lm.lead_id = ac.lead_id
    where ac.organization_id = p_organization_id
    order by ac.lead_id,
      case when ac.platform = lm.channel then 0 else 1 end,
      ac.updated_at desc,
      ac.created_at desc,
      ac.id desc
  ),
  latest_bookings as (
    select distinct on (b.lead_id)
      b.lead_id,
      b.id,
      ru.name as room_name,
      b.check_in,
      b.check_out,
      b.status,
      b.created_at
    from public.bookings b
    left join public.room_units ru on ru.id = b.room_unit_id
    where b.organization_id = p_organization_id
    order by b.lead_id, b.check_in desc, b.created_at desc, b.id desc
  )
  select
    aggregated.lead_id as id,
    aggregated.lead_id,
    coalesce(l.name, lm.metadata ->> 'sender_name', lm.metadata ->> 'from_name', 'Unknown Contact') as lead_name,
    coalesce(l.phone, lm.metadata ->> 'sender_phone', lm.metadata ->> 'from_number', '') as phone,
    coalesce(l.email, '') as email,
    lm.content as last_message_content,
    lm.created_at as last_message_at,
    lm.direction as last_message_direction,
    lm.metadata as last_message_metadata,
    aggregated.unread,
    lm.channel,
    aggregated.message_count,
    aggregated.failed_message_count,
    coalesce(
      selected_ai_conversations.external_id,
      lm.metadata ->> 'sender_id',
      lm.metadata ->> 'external_sender_id'
    ) as external_id,
    latest_bookings.id as linked_booking_id,
    latest_bookings.room_name as linked_booking_room_name,
    latest_bookings.check_in as linked_booking_check_in,
    latest_bookings.check_out as linked_booking_check_out,
    latest_bookings.status as linked_booking_status,
    coalesce(l.is_ai_managed, true) as is_ai_managed,
    l.lead_temperature::text as lead_temperature,
    selected_ai_conversations.status as conversation_status,
    coalesce(selected_ai_conversations.platform, lm.channel) as platform,
    aggregated.started_at
  from aggregated
  join latest_message lm on lm.lead_id = aggregated.lead_id
  left join public.leads l
    on l.id = aggregated.lead_id
   and l.organization_id = p_organization_id
  left join selected_ai_conversations
    on selected_ai_conversations.lead_id = aggregated.lead_id
  left join latest_bookings
    on latest_bookings.lead_id = aggregated.lead_id
  order by lm.created_at desc;
end;
$$;

grant execute on function public.get_chat_conversation_summaries(uuid) to authenticated;

commit;