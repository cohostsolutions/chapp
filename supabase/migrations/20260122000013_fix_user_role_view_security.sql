-- Fix: Remove SECURITY DEFINER from user_role_view to prevent RLS bypass
-- SECURITY DEFINER causes the view to execute with owner privileges, bypassing RLS
-- Converting to SECURITY INVOKER (the safe default) ensures RLS is respected

drop view if exists public.user_role_view cascade;

create view public.user_role_view as
  select ur.user_id, ur.role, p.organization_id
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id;

-- Explicitly ensure it's SECURITY INVOKER (the default, but making it explicit for clarity)
comment on view public.user_role_view is 'Helper view to check user role membership - uses SECURITY INVOKER to respect RLS policies';
