-- Create a safe profiles view that hides TOTP secrets from non-owners
-- Only the profile owner should see their own TOTP secret and backup codes

DROP VIEW IF EXISTS public.profiles_safe;

CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT 
  id,
  email,
  full_name,
  avatar_url,
  organization_id,
  is_active,
  created_at,
  updated_at,
  totp_enabled,
  totp_verified_at,
  -- Only show sensitive 2FA data to the profile owner
  CASE WHEN auth.uid() = id THEN totp_secret ELSE NULL END as totp_secret,
  CASE WHEN auth.uid() = id THEN backup_codes ELSE NULL END as backup_codes
FROM public.profiles;

-- Enable RLS on the view with security_invoker to inherit from base table
ALTER VIEW public.profiles_safe SET (security_invoker = true);

-- Grant appropriate permissions
GRANT SELECT ON public.profiles_safe TO authenticated;