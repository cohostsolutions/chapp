-- Add restrictive baseline policy requiring authentication for profiles table
-- This ensures unauthenticated users can never access profile data
CREATE POLICY "Require authentication for profiles"
ON public.profiles
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);