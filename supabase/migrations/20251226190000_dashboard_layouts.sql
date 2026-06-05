-- Create dashboard_layouts table for storing user dashboard customizations
create table if not exists public.dashboard_layouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  dashboard_type text not null check (dashboard_type in ('jay', 'may', 'cece')),
  layout jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Ensure one layout per user per dashboard type per organization
  unique(organization_id, user_id, dashboard_type)
);

-- Create index for faster queries
create index if not exists idx_dashboard_layouts_user on public.dashboard_layouts(user_id, dashboard_type);
create index if not exists idx_dashboard_layouts_org on public.dashboard_layouts(organization_id);

-- Enable RLS
alter table public.dashboard_layouts enable row level security;

-- RLS Policies (idempotent, short names to avoid truncation)
DROP POLICY IF EXISTS "Users can view own dashboard layouts" ON public.dashboard_layouts;
DROP POLICY IF EXISTS "Users can insert own dashboard layouts" ON public.dashboard_layouts;
DROP POLICY IF EXISTS "Users update dashboard layouts" ON public.dashboard_layouts;
DROP POLICY IF EXISTS "Users delete dashboard layouts" ON public.dashboard_layouts;
DROP POLICY IF EXISTS "Users can update own dashboard layouts or admins can update org layouts" ON public.dashboard_layouts;
DROP POLICY IF EXISTS "Users can update own dashboard layouts or admins can update org" ON public.dashboard_layouts;
DROP POLICY IF EXISTS "Users can delete own dashboard layouts or admins can delete org layouts" ON public.dashboard_layouts;
DROP POLICY IF EXISTS "dashboard_layouts_select" ON public.dashboard_layouts;
DROP POLICY IF EXISTS "dashboard_layouts_insert" ON public.dashboard_layouts;
DROP POLICY IF EXISTS "dashboard_layouts_update" ON public.dashboard_layouts;
DROP POLICY IF EXISTS "dashboard_layouts_delete" ON public.dashboard_layouts;

CREATE POLICY "dashboard_layouts_select"
  ON public.dashboard_layouts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id = dashboard_layouts.organization_id
    )
  );

CREATE POLICY "dashboard_layouts_insert"
  ON public.dashboard_layouts
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id = dashboard_layouts.organization_id
    )
  );

CREATE POLICY "dashboard_layouts_update"
  ON public.dashboard_layouts
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (
      organization_id = get_user_org(auth.uid())
      AND (
        has_role(auth.uid(), 'client_admin'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
      )
    )
  );

CREATE POLICY "dashboard_layouts_delete"
  ON public.dashboard_layouts
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR (
      organization_id = get_user_org(auth.uid())
      AND (
        has_role(auth.uid(), 'client_admin'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
      )
    )
  );

-- Create trigger to update updated_at timestamp
create or replace function public.update_dashboard_layouts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_dashboard_layouts_updated_at on public.dashboard_layouts;
create trigger update_dashboard_layouts_updated_at
  before update on public.dashboard_layouts
  for each row
  execute function public.update_dashboard_layouts_updated_at();
