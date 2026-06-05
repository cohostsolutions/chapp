-- Create a secure view for social_platforms that excludes credentials for non-admin users
-- This view allows regular users to see platform info but not credentials

DROP VIEW IF EXISTS public.social_platforms_safe;
CREATE VIEW public.social_platforms_safe AS
SELECT 
  id,
  organization_id,
  platform,
  display_name,
  webhook_url,
  is_enabled,
  created_at,
  updated_at,
  -- Only show credentials to client_admins and super_admins
  CASE 
    WHEN has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'client_admin') 
    THEN credentials 
    ELSE NULL 
  END as credentials
FROM public.social_platforms;

-- Grant access to the view
GRANT SELECT ON public.social_platforms_safe TO authenticated;

-- Add comment explaining the view purpose
COMMENT ON VIEW public.social_platforms_safe IS 'Safe view of social_platforms that hides credentials from non-admin users';