-- Align Meta direct-login storage with current integration behavior.
-- 1. Ensure facebook_pages exists in all environments.
-- 2. Track page token expiry so refresh jobs and alerts can work.
-- 3. Allow multiple imported Meta assets per organization in social_platforms.

create table if not exists public.facebook_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  page_id text not null,
  page_name text,
  access_token text not null,
  token_expires_at timestamptz,
  is_enabled boolean not null default false,
  connected_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.facebook_pages
  add column if not exists is_enabled boolean not null default false;

alter table if exists public.facebook_pages
  alter column created_at set default now();

alter table if exists public.facebook_pages
  alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'facebook_pages_organization_id_page_id_key'
      and conrelid = 'public.facebook_pages'::regclass
  ) then
    alter table public.facebook_pages
      add constraint facebook_pages_organization_id_page_id_key
      unique (organization_id, page_id);
  end if;
end $$;

create index if not exists idx_facebook_pages_org_enabled
  on public.facebook_pages (organization_id, is_enabled);

update public.facebook_pages
set token_expires_at = coalesce(token_expires_at, created_at + interval '60 days')
where token_expires_at is null;

create or replace view public.facebook_pages_safe
with (security_invoker = true) as
select
  id,
  organization_id,
  page_id,
  page_name,
  token_expires_at,
  is_enabled,
  connected_by,
  created_at,
  updated_at
from public.facebook_pages;

grant select on public.facebook_pages_safe to authenticated;

alter table if exists public.social_platforms
  drop constraint if exists social_platforms_organization_id_platform_key;

drop index if exists public.idx_social_platforms_org_platform_display_name_unique;

create unique index idx_social_platforms_org_platform_display_name_unique
  on public.social_platforms (organization_id, platform, display_name);

drop trigger if exists update_facebook_pages_updated_at on public.facebook_pages;

create trigger update_facebook_pages_updated_at
before update on public.facebook_pages
for each row execute function public.update_updated_at();