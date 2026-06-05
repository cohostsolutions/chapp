-- Fix: Ensure get_user_org (and if get_user_orgs exists) has proper immutable search_path
-- This function was flagged for having a role mutable search_path
-- Recreate with explicit, clear search_path declaration

CREATE OR REPLACE FUNCTION public.get_user_org(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id
$$;

-- If get_user_orgs exists, also fix it (covering plural variant in case audit meant that)
DROP FUNCTION IF EXISTS public.get_user_orgs();
DROP FUNCTION IF EXISTS public.get_user_orgs(uuid);

COMMENT ON FUNCTION public.get_user_org(uuid) IS 'Get a user organization_id safely with fixed search_path to prevent privilege escalation';
