-- Enable training feature per org
alter table if exists public.organizations
  add column if not exists training_enabled boolean not null default false;

-- Training modules created by client admins
create table if not exists public.training_modules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  industry text,
  difficulty text,
  persona jsonb not null default '{}',
  objectives text[] not null default '{}',
  rubric jsonb not null default '[]', -- array of categories {id,name,description,guidelines[],weight}
  visibility text not null default 'active', -- active | archived
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_training_modules_org on public.training_modules(organization_id);

-- Training sessions (agent attempts)
create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.training_modules(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  score numeric,
  evaluation jsonb,
  transcript jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_training_sessions_org on public.training_sessions(organization_id);
create index if not exists idx_training_sessions_module on public.training_sessions(module_id);

-- Row Level Security
alter table public.training_modules enable row level security;
alter table public.training_sessions enable row level security;

-- Helpers to check role membership
create or replace view public.user_role_view as
  select ur.user_id, ur.role, p.organization_id
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id;

-- Policies for training_modules
do $$
begin
  -- Select: org members only
  if not exists (select 1 from pg_policies where tablename = 'training_modules' and policyname = 'Org members can select modules') then
    create policy "Org members can select modules" on public.training_modules
      for select
      using (
        exists(
          select 1 from public.user_role_view v
          where v.user_id = auth.uid()
          and v.organization_id = training_modules.organization_id
        )
      );
  end if;

  -- Insert/update/delete: client_admin or super_admin in org
  if not exists (select 1 from pg_policies where tablename = 'training_modules' and policyname = 'Admins manage modules') then
    create policy "Admins manage modules" on public.training_modules
      for all
      using (
        exists(
          select 1 from public.user_role_view v
          where v.user_id = auth.uid()
          and v.organization_id = training_modules.organization_id
          and v.role in ('client_admin','super_admin')
        )
      )
      with check (
        exists(
          select 1 from public.user_role_view v
          where v.user_id = auth.uid()
          and v.organization_id = training_modules.organization_id
          and v.role in ('client_admin','super_admin')
        )
      );
  end if;
end$$;

-- Policies for training_sessions
do $$
begin
  -- Select: org members only
  if not exists (select 1 from pg_policies where tablename = 'training_sessions' and policyname = 'Org members can select sessions') then
    create policy "Org members can select sessions" on public.training_sessions
      for select
      using (
        exists(
          select 1 from public.user_role_view v
          where v.user_id = auth.uid()
          and v.organization_id = training_sessions.organization_id
        )
      );
  end if;

  -- Insert: any org member (agents included)
  if not exists (select 1 from pg_policies where tablename = 'training_sessions' and policyname = 'Members can insert sessions') then
    create policy "Members can insert sessions" on public.training_sessions
      for insert
      with check (
        exists(
          select 1 from public.user_role_view v
          where v.user_id = auth.uid()
          and v.organization_id = training_sessions.organization_id
        )
      );
  end if;

  -- Update/delete: session owner or org admins
  if not exists (select 1 from pg_policies where tablename = 'training_sessions' and policyname = 'Owner or admins manage sessions') then
    create policy "Owner or admins manage sessions" on public.training_sessions
      for all
      using (
        (training_sessions.user_id = auth.uid()) OR
        exists(
          select 1 from public.user_role_view v
          where v.user_id = auth.uid()
          and v.organization_id = training_sessions.organization_id
          and v.role in ('client_admin','super_admin')
        )
      )
      with check (
        (training_sessions.user_id = auth.uid()) OR
        exists(
          select 1 from public.user_role_view v
          where v.user_id = auth.uid()
          and v.organization_id = training_sessions.organization_id
          and v.role in ('client_admin','super_admin')
        )
      );
  end if;
end$$;

comment on table public.training_modules is 'AI training modules managed by client admins';
comment on table public.training_sessions is 'Recorded training sessions with evaluations';

-- Rubric templates for reuse
create table if not exists public.rubric_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  rubric jsonb not null default '[]',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rubric_templates_org on public.rubric_templates(organization_id);

alter table public.rubric_templates enable row level security;

-- PII and compliance settings
alter table if exists public.organizations
  add column if not exists training_pii_redaction boolean not null default false,
  add column if not exists training_retention_days integer;

-- RLS for templates
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'rubric_templates' and policyname = 'Org members can select templates') then
    create policy "Org members can select templates" on public.rubric_templates
      for select
      using (
        exists(
          select 1 from public.user_role_view v
          where v.user_id = auth.uid()
          and v.organization_id = rubric_templates.organization_id
        )
      );
  end if;

  if not exists (select 1 from pg_policies where tablename = 'rubric_templates' and policyname = 'Admins manage templates') then
    create policy "Admins manage templates" on public.rubric_templates
      for all
      using (
        exists(
          select 1 from public.user_role_view v
          where v.user_id = auth.uid()
          and v.organization_id = rubric_templates.organization_id
          and v.role in ('client_admin','super_admin')
        )
      )
      with check (
        exists(
          select 1 from public.user_role_view v
          where v.user_id = auth.uid()
          and v.organization_id = rubric_templates.organization_id
          and v.role in ('client_admin','super_admin')
        )
      );
  end if;
end$$;

-- Enhanced analytics helper with agent breakdown and date filters
create or replace function public.training_stats(
  p_org_id uuid,
  p_start_date timestamptz default null,
  p_end_date timestamptz default null,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  total integer;
  avg_score numeric;
  top jsonb;
  agents jsonb;
begin
  -- Apply filters
  select count(*), avg(score) 
  into total, avg_score 
  from public.training_sessions 
  where organization_id = p_org_id
    and (p_start_date is null or started_at >= p_start_date)
    and (p_end_date is null or started_at <= p_end_date)
    and (p_user_id is null or user_id = p_user_id);

  -- Top modules
  top := (
    select jsonb_agg(row_to_json(t)) from (
      select module_id as id,
             (select title from public.training_modules m where m.id = s.module_id) as title,
             count(*) as count,
             avg(score) as avg_score
      from public.training_sessions s
      where s.organization_id = p_org_id
        and (p_start_date is null or s.started_at >= p_start_date)
        and (p_end_date is null or s.started_at <= p_end_date)
        and (p_user_id is null or s.user_id = p_user_id)
      group by module_id
      order by count desc
      limit 5
    ) t
  );

  -- Agent breakdown
  agents := (
    select jsonb_agg(row_to_json(a)) from (
      select s.user_id as id,
             (select full_name from public.profiles p where p.id = s.user_id) as name,
             count(*) as sessions,
             avg(s.score) as avg_score
      from public.training_sessions s
      where s.organization_id = p_org_id
        and (p_start_date is null or s.started_at >= p_start_date)
        and (p_end_date is null or s.started_at <= p_end_date)
        and (p_user_id is null or s.user_id = p_user_id)
      group by s.user_id
      order by avg_score desc nulls last
      limit 10
    ) a
  );

  return jsonb_build_object(
    'totalSessions', coalesce(total,0),
    'avgScore', avg_score,
    'topModules', coalesce(top, '[]'::jsonb),
    'agentBreakdown', coalesce(agents, '[]'::jsonb)
  );
end;
$$;
