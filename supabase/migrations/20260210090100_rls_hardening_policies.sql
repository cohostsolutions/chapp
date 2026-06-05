-- RLS hardening: policies and grants

-- 1) Profiles: secure GRANTs (insert/update only safe columns)
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;
DO $$
DECLARE
  grant_cols text;
BEGIN
  SELECT string_agg(quote_ident(c.column_name), ', ')
  INTO grant_cols
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'profiles'
    AND c.column_name IN ('display_name', 'avatar_url', 'bio');

  IF grant_cols IS NOT NULL THEN
    EXECUTE format('GRANT INSERT (%s) ON public.profiles TO authenticated', grant_cols);
    EXECUTE format('GRANT UPDATE (%s) ON public.profiles TO authenticated', grant_cols);
  ELSE
    RAISE NOTICE 'Skipping column-level GRANT on public.profiles: none of (display_name, avatar_url, bio) exist';
  END IF;
END$$;

-- 3) Role source hardening
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'profiles'
      AND c.column_name = 'impersonated_role'
  ) THEN
    REVOKE UPDATE (impersonated_role) ON public.profiles FROM authenticated;
  ELSE
    RAISE NOTICE 'Skipping column-level REVOKE on public.profiles: impersonated_role does not exist';
  END IF;
END$$;

-- 4) current_user_role(): stable, definer, restricted search_path; uses is_active
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT ur.role
       FROM public.user_roles ur
       WHERE ur.user_id = auth.uid() AND ur.is_active = true
       ORDER BY ur.expires_at NULLS LAST
       LIMIT 1),
    (SELECT p.impersonated_role
       FROM public.profiles p
       WHERE p.id = auth.uid() AND p.impersonated_role IS NOT NULL
       LIMIT 1),
    'viewer'::public.app_role
  )
$$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_definer')
     AND pg_has_role(current_user, 'app_definer', 'USAGE') THEN
    ALTER FUNCTION public.current_user_role() OWNER TO app_definer;
  ELSE
    RAISE NOTICE 'Skipping OWNER change for public.current_user_role(): current role cannot SET ROLE app_definer';
  END IF;
END$$;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- 2) Profiles: INSERT policy — allowed roles + super_admin bypass
DROP POLICY IF EXISTS profiles_insert_org_or_super ON public.profiles;
CREATE POLICY profiles_insert_org_or_super
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  (
    current_user_role() IN ('viewer','agent','client_admin')
    AND organization_id = get_user_organization()
    AND id = (SELECT auth.uid())
  )
  OR current_user_role() = 'super_admin'
);

-- 5) Grant minimal read to app_definer for functions that need it (no BYPASSRLS)
GRANT SELECT ON public.profiles TO app_definer;
GRANT SELECT ON public.user_roles TO app_definer;

-- 6) RLS policies so app_definer can read role sources (required if RLS is enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_definer_read ON public.profiles;
CREATE POLICY profiles_definer_read
ON public.profiles
FOR SELECT
TO app_definer
USING (true);

DROP POLICY IF EXISTS user_roles_definer_read ON public.user_roles;
CREATE POLICY user_roles_definer_read
ON public.user_roles
FOR SELECT
TO app_definer
USING (true);

-- Note on RLS and SECURITY DEFINER:
-- - app_definer has no BYPASSRLS, so RLS still applies.
-- - If a definer function must bypass RLS, use a dedicated role with BYPASSRLS very selectively and document why.
