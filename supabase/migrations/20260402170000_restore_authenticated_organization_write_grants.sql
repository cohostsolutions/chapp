-- Allow browser-authenticated organization management while RLS remains the access boundary.
GRANT INSERT, UPDATE ON public.organizations TO authenticated;