-- Add RLS policies to login_attempts table for security monitoring

-- Allow super admins to view login attempts for security monitoring
DROP POLICY IF EXISTS "Super admins view login attempts" ON public.login_attempts;
CREATE POLICY "Super admins view login attempts" 
ON public.login_attempts 
FOR SELECT 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Allow inserting login attempts (used by database functions for logging)
DROP POLICY IF EXISTS "Allow insert login attempts" ON public.login_attempts;
CREATE POLICY "Allow insert login attempts" 
ON public.login_attempts 
FOR INSERT 
WITH CHECK (true);