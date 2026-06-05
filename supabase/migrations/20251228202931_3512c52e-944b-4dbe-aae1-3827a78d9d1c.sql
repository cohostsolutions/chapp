-- Fix SECURITY DEFINER view warnings by recreating views with SECURITY INVOKER

-- Recreate profiles_safe with SECURITY INVOKER
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe 
WITH (security_invoker = on)
AS
SELECT 
  id,
  organization_id,
  email,
  full_name,
  avatar_url,
  is_active,
  created_at,
  updated_at,
  totp_enabled,
  totp_verified_at
FROM public.profiles;

GRANT SELECT ON public.profiles_safe TO authenticated;

COMMENT ON VIEW public.profiles_safe IS 'Safe view of profiles excluding TOTP secrets and backup codes. Use this for admin/org member lookups.';

-- Recreate user_sessions_safe with SECURITY INVOKER
DROP VIEW IF EXISTS public.user_sessions_safe;

CREATE VIEW public.user_sessions_safe
WITH (security_invoker = on)
AS
SELECT 
  id,
  user_id,
  device_type,
  is_active,
  last_activity_at,
  expires_at,
  created_at,
  CASE 
    WHEN ip_address IS NOT NULL THEN 
      split_part(ip_address, '.', 1) || '.xxx.xxx.xxx'
    ELSE NULL
  END as ip_masked
FROM public.user_sessions;

GRANT SELECT ON public.user_sessions_safe TO authenticated;

COMMENT ON VIEW public.user_sessions_safe IS 'Safe view of user sessions with masked IP addresses. Use this for security monitoring dashboards.';