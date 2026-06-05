-- Add restrictive baseline policy requiring authentication for google_calendar_tokens table
-- This ensures unauthenticated users can never access OAuth tokens
CREATE POLICY "Require authentication for google_calendar_tokens"
ON public.google_calendar_tokens
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);