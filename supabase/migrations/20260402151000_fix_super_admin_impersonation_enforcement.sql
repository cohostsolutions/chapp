-- Ensure super admins are only marked as impersonating when explicitly acting as a lower role.
CREATE OR REPLACE FUNCTION public.profiles_impersonation_enforce()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.user_role = 'super_admin'::public.app_role THEN
    IF NEW.impersonated_role NOT IN ('client_admin'::public.app_role, 'agent'::public.app_role) THEN
      NEW.impersonated_role := NULL;
    END IF;
  ELSE
    NEW.impersonated_role := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

UPDATE public.profiles
SET impersonated_role = NULL,
    updated_at = now()
WHERE user_role = 'super_admin'::public.app_role
  AND impersonated_role = 'super_admin'::public.app_role;