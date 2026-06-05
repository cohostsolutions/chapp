-- ============================================
-- SECURITY FIX 1: Profiles TOTP secrets exposure
-- ============================================

-- Drop and recreate profiles_safe view to EXCLUDE sensitive 2FA fields
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe AS
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
  -- INTENTIONALLY EXCLUDED: totp_secret, backup_codes
FROM public.profiles;

-- Grant access to the safe view
GRANT SELECT ON public.profiles_safe TO authenticated;

-- Update profiles RLS: Only users can see their own TOTP secrets
-- Drop existing select policy
DROP POLICY IF EXISTS "Users view authorized profiles" ON public.profiles;

-- Create new policy: Users see FULL profile (including TOTP) for themselves only
CREATE POLICY "Users view own full profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Admins must use profiles_safe view - they cannot directly query profiles table
-- This ensures TOTP secrets are never exposed to admins

-- ============================================
-- SECURITY FIX 2: User sessions tracking exposure  
-- ============================================

-- Drop and recreate user_sessions_safe view for admin monitoring
-- Excludes sensitive tracking data (IP, location, user_agent details)
DROP VIEW IF EXISTS public.user_sessions_safe;

CREATE VIEW public.user_sessions_safe AS
SELECT 
  id,
  user_id,
  device_type,
  is_active,
  last_activity_at,
  expires_at,
  created_at,
  -- Mask IP address for privacy (show only first part)
  CASE 
    WHEN ip_address IS NOT NULL THEN 
      split_part(ip_address, '.', 1) || '.xxx.xxx.xxx'
    ELSE NULL
  END as ip_masked
  -- INTENTIONALLY EXCLUDED: full ip_address, user_agent, location
FROM public.user_sessions;

-- Grant access to the safe view
GRANT SELECT ON public.user_sessions_safe TO authenticated;

-- Update user_sessions RLS: Super admins should use the safe view
DROP POLICY IF EXISTS "Super admins can view all sessions" ON public.user_sessions;

-- Super admins can only see sessions from their own organization's users (via profiles)
-- or must use the user_sessions_safe view for cross-org monitoring
CREATE POLICY "Admins view org user sessions"
ON public.user_sessions
FOR SELECT
USING (
  -- Users can always see their own sessions
  user_id = auth.uid()
  OR
  -- Client admins can see sessions for users in their org
  (has_role(auth.uid(), 'client_admin'::app_role) AND EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = user_sessions.user_id 
    AND p.organization_id = get_user_org(auth.uid())
  ))
);

-- Super admins should use user_sessions_safe view for security monitoring
-- This prevents direct access to sensitive tracking data

-- Add comment explaining the security model
COMMENT ON VIEW public.profiles_safe IS 'Safe view of profiles excluding TOTP secrets and backup codes. Use this for admin/org member lookups.';
COMMENT ON VIEW public.user_sessions_safe IS 'Safe view of user sessions with masked IP addresses. Use this for security monitoring dashboards.';