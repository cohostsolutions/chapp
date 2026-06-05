-- Fix: Remove overly permissive RLS policy on email_queue
-- The policy "System can manage email queue" uses USING (true) which bypasses RLS
-- email_queue should only be accessible by service_role, not via RLS policies

-- Drop the problematic policy
DROP POLICY IF EXISTS "System can manage email queue" ON public.email_queue;
DROP POLICY IF EXISTS "Super admins can manage email queue" ON public.email_queue;

-- email_queue is meant to be accessed only by service_role via edge functions
-- Service role bypasses RLS, so we don't need permissive policies
-- Add an explicit deny policy for authenticated/anon users to make intent clear
CREATE POLICY "Block direct access to email queue"
ON public.email_queue 
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

-- Only service_role can access this table (service_role bypasses RLS)
-- This policy ensures regular users cannot accidentally access the queue

COMMENT ON POLICY "Block direct access to email queue" ON public.email_queue IS 'Email queue is only accessible via service_role in edge functions, not by end users';
