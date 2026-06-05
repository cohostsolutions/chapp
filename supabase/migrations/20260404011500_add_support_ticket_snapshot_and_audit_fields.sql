begin;

alter table public.helpdesk_tickets
  add column if not exists assigned_at timestamptz,
  add column if not exists assigned_by_admin_id uuid,
  add column if not exists resolved_by_admin_id uuid;

update public.team_chats
set is_helpdesk_channel = true
where chat_type = 'helpdesk'
  and coalesce(is_helpdesk_channel, false) = false;

create or replace function public.get_support_tickets_snapshot()
returns table (
  id uuid,
  organization_id uuid,
  organization_name text,
  requester_id uuid,
  requester_name text,
  requester_email text,
  requester_avatar_url text,
  subject text,
  priority text,
  status text,
  chat_id uuid,
  assigned_admin_id uuid,
  assigned_admin_name text,
  assigned_admin_email text,
  assigned_at timestamptz,
  assigned_by_admin_id uuid,
  assigned_by_name text,
  created_at timestamptz,
  updated_at timestamptz,
  resolved_at timestamptz,
  resolved_by_admin_id uuid,
  resolved_by_name text,
  last_message_at timestamptz,
  last_message_preview text,
  last_message_sender_id uuid,
  last_message_sender_name text,
  needs_admin_reply boolean,
  waiting_on text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not public.has_role(current_user_id, 'super_admin'::public.app_role) then
    raise exception 'Access denied';
  end if;

  return query
  with last_messages as (
    select distinct on (m.chat_id)
      m.chat_id,
      m.sender_id,
      nullif(trim(coalesce(m.content, '')), '') as content,
      m.created_at
    from public.team_chat_messages m
    order by m.chat_id, m.created_at desc, m.id desc
  )
  select
    t.id,
    t.organization_id,
    o.name as organization_name,
    t.requester_id,
    req.full_name as requester_name,
    req.email as requester_email,
    req.avatar_url as requester_avatar_url,
    t.subject,
    t.priority,
    t.status,
    t.chat_id,
    t.assigned_admin_id,
    assigned.full_name as assigned_admin_name,
    assigned.email as assigned_admin_email,
    t.assigned_at,
    t.assigned_by_admin_id,
    assigner.full_name as assigned_by_name,
    t.created_at,
    t.updated_at,
    t.resolved_at,
    t.resolved_by_admin_id,
    resolver.full_name as resolved_by_name,
    lm.created_at as last_message_at,
    case
      when lm.content is null then null
      when char_length(lm.content) > 140 then left(lm.content, 137) || '...'
      else lm.content
    end as last_message_preview,
    lm.sender_id as last_message_sender_id,
    coalesce(sender.full_name, sender.email) as last_message_sender_name,
    case
      when t.status = 'resolved' then false
      when lm.chat_id is null then true
      when lm.sender_id = t.requester_id then true
      else false
    end as needs_admin_reply,
    case
      when t.status = 'resolved' then 'resolved'
      when lm.chat_id is null then 'admin'
      when lm.sender_id = t.requester_id then 'admin'
      else 'requester'
    end as waiting_on
  from public.helpdesk_tickets t
  join public.organizations o
    on o.id = t.organization_id
  left join public.profiles_safe req
    on req.id = t.requester_id
  left join public.profiles_safe assigned
    on assigned.id = t.assigned_admin_id
  left join public.profiles_safe assigner
    on assigner.id = t.assigned_by_admin_id
  left join public.profiles_safe resolver
    on resolver.id = t.resolved_by_admin_id
  left join last_messages lm
    on lm.chat_id = t.chat_id
  left join public.profiles_safe sender
    on sender.id = lm.sender_id
  order by coalesce(lm.created_at, t.updated_at, t.created_at) desc, t.created_at desc;
end;
$$;

grant execute on function public.get_support_tickets_snapshot() to authenticated;

commit;