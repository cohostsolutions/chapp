create table if not exists public.social_integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'meta',
  initiated_by uuid references auth.users(id) on delete set null,
  action text not null,
  status text not null check (status in ('success', 'partial', 'incomplete', 'error')),
  pages_count integer not null default 0 check (pages_count >= 0),
  instagram_count integer not null default 0 check (instagram_count >= 0),
  whatsapp_count integer not null default 0 check (whatsapp_count >= 0),
  warnings jsonb not null default '[]'::jsonb,
  failures jsonb not null default '[]'::jsonb,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.social_integration_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  provider text not null default 'meta',
  event_type text not null,
  asset_type text,
  asset_id text,
  asset_name text,
  status text not null default 'success' check (status in ('info', 'success', 'warning', 'error')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_social_integration_sync_runs_org_created_at
  on public.social_integration_sync_runs (organization_id, created_at desc);

create index if not exists idx_social_integration_sync_runs_status
  on public.social_integration_sync_runs (status, created_at desc);

create index if not exists idx_social_integration_events_org_created_at
  on public.social_integration_events (organization_id, created_at desc);

create index if not exists idx_social_integration_events_event_type
  on public.social_integration_events (event_type, created_at desc);

alter table public.social_integration_sync_runs enable row level security;
alter table public.social_integration_events enable row level security;

drop policy if exists "Admins view social integration sync runs" on public.social_integration_sync_runs;
create policy "Admins view social integration sync runs"
on public.social_integration_sync_runs
for select
using (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  or (
    public.has_role(auth.uid(), 'client_admin'::public.app_role)
    and organization_id = public.get_user_org(auth.uid())
  )
);

drop policy if exists "Admins view social integration events" on public.social_integration_events;
create policy "Admins view social integration events"
on public.social_integration_events
for select
using (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  or (
    public.has_role(auth.uid(), 'client_admin'::public.app_role)
    and organization_id = public.get_user_org(auth.uid())
  )
);

grant select on public.social_integration_sync_runs to authenticated;
grant select on public.social_integration_events to authenticated;

grant select, insert, update, delete on public.social_integration_sync_runs to service_role;
grant select, insert, update, delete on public.social_integration_events to service_role;

create or replace function public.log_social_integration_event(
  p_organization_id uuid,
  p_event_type text,
  p_provider text default 'meta',
  p_asset_type text default null,
  p_asset_id text default null,
  p_asset_name text default null,
  p_status text default 'success',
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event_id uuid;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if p_status not in ('info', 'success', 'warning', 'error') then
    raise exception 'Invalid social integration event status';
  end if;

  if not (
    public.has_role(v_user_id, 'super_admin'::public.app_role)
    or (
      public.has_role(v_user_id, 'client_admin'::public.app_role)
      and p_organization_id = public.get_user_org(v_user_id)
    )
  ) then
    raise exception 'Forbidden';
  end if;

  insert into public.social_integration_events (
    organization_id,
    actor_user_id,
    provider,
    event_type,
    asset_type,
    asset_id,
    asset_name,
    status,
    details
  )
  values (
    p_organization_id,
    v_user_id,
    coalesce(nullif(p_provider, ''), 'meta'),
    p_event_type,
    p_asset_type,
    p_asset_id,
    p_asset_name,
    p_status,
    coalesce(p_details, '{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

grant execute on function public.log_social_integration_event(uuid, text, text, text, text, text, text, jsonb) to authenticated;