begin;

create or replace function public.get_organizations_snapshot()
returns table (
  id uuid,
  name text,
  slug text,
  created_at timestamptz,
  ai_agent_type text,
  is_archived boolean,
  member_count bigint,
  primary_count bigint
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
  select
    o.id,
    o.name,
    o.slug,
    o.created_at,
    o.ai_agent_type::text,
    coalesce(o.is_archived, false),
    (
      select count(*)
      from public.profiles_safe ps
      where ps.organization_id = o.id
    ),
    case coalesce(o.ai_agent_type::text, 'jay')
      when 'may' then (
        select count(*)
        from public.orders ord
        where ord.organization_id = o.id
      )
      when 'cece' then (
        select count(*)
        from public.bookings b
        where b.organization_id = o.id
      )
      else (
        select count(*)
        from public.leads l
        where l.organization_id = o.id
      )
    end
  from public.organizations o
  order by o.created_at desc;
end;
$$;

grant execute on function public.get_organizations_snapshot() to authenticated;

commit;