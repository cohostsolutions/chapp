-- Fix overly permissive RLS policies
-- These policies currently use WITH CHECK (true) which allows any role to insert

-- 1. Fix audit_logs - should only be insertable by service role (edge functions)
-- The policy name says "service role" but applies to public - this is a misconfiguration
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;
-- Note: Service role bypasses RLS by default, so we just need to block other roles
CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (
  -- Only allow authenticated users to insert their own audit logs
  user_id = auth.uid() OR user_id IS NULL
);

-- 2. Fix demo_requests - add validation (rate limiting is done by trigger already)
-- Keep public access but ensure basic validation
DROP POLICY IF EXISTS "Public can submit demo requests" ON public.demo_requests;
CREATE POLICY "Public can submit demo requests with validation"
ON public.demo_requests FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Ensure required fields are not empty
  email IS NOT NULL AND 
  email <> '' AND
  name IS NOT NULL AND 
  name <> '' AND
  business_type IS NOT NULL AND
  business_type <> ''
);

-- 3. Fix health_check_history - should only be insertable by service role
DROP POLICY IF EXISTS "Service role can insert health history" ON public.health_check_history;
-- No policy needed - service role bypasses RLS
-- Add explicit deny for other roles
CREATE POLICY "Block non-service role inserts to health history"
ON public.health_check_history FOR INSERT
TO authenticated, anon
WITH CHECK (false);

-- 4. Fix login_attempts - restrict to prevent abuse
DROP POLICY IF EXISTS "Allow insert login attempts" ON public.login_attempts;
-- Login attempts should be recorded by the system, not directly by users
-- We'll allow it but add validation
CREATE POLICY "System can record login attempts"
ON public.login_attempts FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Ensure the email matches the session email (if authenticated) or allow anon for failed logins
  (auth.jwt() IS NULL) OR 
  (LOWER(email) = LOWER((auth.jwt()->>'email')::text))
);

-- 5. Fix notification_history - should be insertable by the system for the user
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notification_history;
CREATE POLICY "Users can receive notifications"
ON public.notification_history FOR INSERT
TO authenticated
WITH CHECK (
  -- Users can only have notifications created for themselves
  user_id = auth.uid()
);