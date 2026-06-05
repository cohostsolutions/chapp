-- Fix 1: calendar_sync_events - Remove overly permissive service role policy and add proper RLS
DROP POLICY IF EXISTS "Service role manages calendar_sync_events" ON public.calendar_sync_events;

-- Add proper RLS policies for calendar_sync_events
DROP POLICY IF EXISTS "Super admins manage calendar_sync_events" ON public.calendar_sync_events;
DROP POLICY IF EXISTS "Client admins manage org calendar_sync_events" ON public.calendar_sync_events;
DROP POLICY IF EXISTS "Agents view org calendar_sync_events" ON public.calendar_sync_events;

CREATE POLICY "Super admins manage calendar_sync_events" 
ON public.calendar_sync_events 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Client admins manage org calendar_sync_events" 
ON public.calendar_sync_events 
FOR ALL 
USING (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()));

CREATE POLICY "Agents view org calendar_sync_events" 
ON public.calendar_sync_events 
FOR SELECT 
USING (has_role(auth.uid(), 'agent'::app_role) AND organization_id = get_user_org(auth.uid()));

-- Fix 2: webhook_health - Remove overly permissive service role policy
DROP POLICY IF EXISTS "Service role manages webhook_health" ON public.webhook_health;

-- Fix 3: demo_requests - Restrict public SELECT (only super admins should view)
-- The INSERT policy for public is intentional for demo request submissions
-- No changes needed - super admins already have SELECT, public only has INSERT

-- Fix 4: profiles_safe view - This is a VIEW, not a table
-- Views inherit RLS from underlying tables, but we should drop and recreate with security_invoker
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe 
WITH (security_invoker = true)
AS SELECT 
  id,
  organization_id,
  is_active,
  created_at,
  updated_at,
  totp_enabled,
  totp_verified_at,
  email,
  full_name,
  avatar_url,
  -- Mask sensitive fields
  NULL::text as totp_secret,
  NULL::text[] as backup_codes
FROM public.profiles;

-- Fix 5: social_platforms_safe view - Same treatment
DROP VIEW IF EXISTS public.social_platforms_safe;

CREATE VIEW public.social_platforms_safe
WITH (security_invoker = true)
AS SELECT 
  id,
  organization_id,
  is_enabled,
  created_at,
  updated_at,
  -- Mask credentials for security
  NULL::jsonb as credentials,
  platform,
  display_name,
  webhook_url
FROM public.social_platforms;