-- Drop restrictive policies and create permissive ones for anonymous insert
DROP POLICY IF EXISTS "Anyone can submit demo request" ON public.demo_requests;
DROP POLICY IF EXISTS "Anyone can submit demo requests" ON public.demo_requests;

-- Create a PERMISSIVE policy for anonymous inserts
CREATE POLICY "Public can submit demo requests"
ON public.demo_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);