-- Add explicit RLS policies for authenticated users on the profiles table.
--
-- Background: The Profile Settings tab issues a SELECT to fetch the current
-- user's profile and an UPDATE to save changes (full_name, avatar_url).  Both
-- operations were returning HTTP 403 because no dedicated, narrowly-scoped
-- policy existed for the `authenticated` role.
--
-- A blanket "unified_profiles_policy" (FOR ALL / TO public) was in place but
-- depends on helper functions (has_role, get_user_org) that read from
-- profiles themselves, which can cause evaluation errors when bootstrapping
-- the first SELECT.  The explicit policies below use only auth.uid() and
-- avoid any recursive table access.
--
-- How to apply
-- ------------
-- Option A – Supabase CLI (recommended):
--   supabase db push
--
-- Option B – Supabase Dashboard SQL editor:
--   Paste the contents of this file and run it.
--
-- Option C – psql:
--   psql "$DATABASE_URL" -f supabase/migrations/20260420000000_add_profiles_rls_policies.sql

-- Ensure RLS is enabled (idempotent).
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Ensure the authenticated role holds the minimum required table privileges.
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, avatar_url) ON public.profiles TO authenticated;

-- SELECT policy: an authenticated user may read their own profile row.
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

-- UPDATE policy: an authenticated user may update their own profile row.
-- The WITH CHECK mirrors the USING clause so a user cannot change their own
-- id to impersonate another account.
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);
