-- RLS hardening: schema changes

-- 0) Role for SECURITY DEFINER helpers (no login)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_definer') THEN
    CREATE ROLE app_definer NOLOGIN;
  END IF;
END$$;

-- 0.1) get_user_organization helper (required for defaults)
CREATE OR REPLACE FUNCTION public.get_user_organization()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.organization_id
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid())
  LIMIT 1
$$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_definer')
     AND pg_has_role(current_user, 'app_definer', 'USAGE') THEN
    ALTER FUNCTION public.get_user_organization() OWNER TO app_definer;
  ELSE
    RAISE NOTICE 'Skipping OWNER change for public.get_user_organization(): current role cannot SET ROLE app_definer';
  END IF;
END$$;
REVOKE ALL ON FUNCTION public.get_user_organization() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_organization() TO authenticated;

-- 1) Profiles: remove BEFORE INSERT trigger (RLS checks before triggers)
DROP TRIGGER IF EXISTS trg_profiles_set_self_defaults ON public.profiles;
DROP FUNCTION IF EXISTS public.profiles_set_self_defaults();

-- 2) Profiles: server-side defaults so RLS sees non-NULL values
ALTER TABLE public.profiles
  ALTER COLUMN id SET DEFAULT auth.uid(),
  ALTER COLUMN organization_id SET DEFAULT get_user_organization();

-- If your auth.uid() is not uuid, adjust with ::uuid or change column type accordingly:
-- ALTER TABLE public.profiles ALTER COLUMN id SET DATA TYPE uuid USING id::uuid;
-- ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT (auth.uid())::uuid;

-- 3) Profiles: idempotent PK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'profiles'
      AND c.contype = 'p'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
  END IF;
END$$;

-- 4) user_roles: ensure is_active boolean (not generated), with trigger to maintain from expires_at
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;

-- Maintain is_active from expires_at
CREATE OR REPLACE FUNCTION public.user_roles_sync_is_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.is_active := true;
  ELSE
    NEW.is_active := (NEW.expires_at > now());
  END IF;
  RETURN NEW;
END;
$$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_definer')
     AND pg_has_role(current_user, 'app_definer', 'USAGE') THEN
    ALTER FUNCTION public.user_roles_sync_is_active() OWNER TO app_definer;
  ELSE
    RAISE NOTICE 'Skipping OWNER change for public.user_roles_sync_is_active(): current role cannot SET ROLE app_definer';
  END IF;
END$$;

DROP TRIGGER IF EXISTS trg_user_roles_sync_is_active_ins ON public.user_roles;
CREATE TRIGGER trg_user_roles_sync_is_active_ins
BEFORE INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.user_roles_sync_is_active();

-- Fire on any UPDATE to keep is_active consistent
DROP TRIGGER IF EXISTS trg_user_roles_sync_is_active_upd ON public.user_roles;
CREATE TRIGGER trg_user_roles_sync_is_active_upd
BEFORE UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.user_roles_sync_is_active();

-- 5) Indexes for role resolution
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_user_active
ON public.user_roles (user_id)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_roles_user_active_expires
ON public.user_roles (user_id, is_active, expires_at);
