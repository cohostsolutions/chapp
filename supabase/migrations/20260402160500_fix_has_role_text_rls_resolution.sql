-- Ensure role checks used by RLS can resolve active roles without recursive policy failures.
CREATE OR REPLACE FUNCTION public.has_role_text(uid uuid, role_text text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = uid
      AND ur.role::text = role_text
      AND COALESCE(ur.is_active, true) = true
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  );
$function$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_definer')
     AND pg_has_role(current_user, 'app_definer', 'USAGE') THEN
    ALTER FUNCTION public.has_role_text(uuid, text) OWNER TO app_definer;
  END IF;
END$$;

REVOKE ALL ON FUNCTION public.has_role_text(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role_text(uuid, text) TO authenticated, anon, service_role;