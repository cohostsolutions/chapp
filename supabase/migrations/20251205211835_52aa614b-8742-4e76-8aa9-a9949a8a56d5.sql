-- 1. Note: Storage bucket policies must be configured directly in the Supabase dashboard.
-- (Removing storage.objects policy modifications - cannot be done via migrations)

-- 2. Fix Google Calendar tokens - remove overly permissive "ALL" policy
DROP POLICY IF EXISTS "Require authentication for google_calendar_tokens" ON google_calendar_tokens;

-- 3. Fix social_platforms_safe view to filter by organization
DROP VIEW IF EXISTS social_platforms_safe;

CREATE VIEW social_platforms_safe WITH (security_invoker = true) AS
SELECT 
  id,
  organization_id,
  platform,
  display_name,
  is_enabled,
  webhook_url,
  created_at,
  updated_at,
  CASE 
    WHEN has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'client_admin') 
    THEN credentials
    ELSE NULL
  END as credentials
FROM social_platforms
WHERE organization_id = get_user_org(auth.uid()) 
   OR has_role(auth.uid(), 'super_admin');