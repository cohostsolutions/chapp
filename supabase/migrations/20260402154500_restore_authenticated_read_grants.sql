-- Restore authenticated read access for app bootstrap queries.
-- RLS remains the access control boundary for these tables.
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.organizations TO authenticated;