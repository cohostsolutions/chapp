-- Drop the insecure anonymous insert policy
DROP POLICY IF EXISTS "Allow anonymous insert analytics events" ON public.analytics_events;

-- Create new policy requiring authentication for inserts
CREATE POLICY "Authenticated users insert analytics events"
ON public.analytics_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Also allow super admins full access for management
CREATE POLICY "Super admins manage analytics events"
ON public.analytics_events
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));