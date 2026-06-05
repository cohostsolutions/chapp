-- Fix remaining overly permissive RLS policies
-- Both tables have "service role" policies that apply to all roles with USING(true) and WITH CHECK(true)

-- 1. Fix ip_blocklist - should only be managed by super_admins or service role
DROP POLICY IF EXISTS "Service role can manage ip_blocklist" ON public.ip_blocklist;

-- Super admins can manage the IP blocklist
CREATE POLICY "Super admins can manage ip_blocklist"
ON public.ip_blocklist FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- 2. Fix webhook_processed_messages - should only be accessible by service role (edge functions)
DROP POLICY IF EXISTS "Service role full access" ON public.webhook_processed_messages;

-- Block all non-service-role access (service role bypasses RLS automatically)
CREATE POLICY "Block non-service role access to webhook messages"
ON public.webhook_processed_messages FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);