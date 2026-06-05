-- Fix: Remove overly permissive RLS policy on demo_requests
-- The policy "Anyone can submit demo request" uses WITH CHECK (true) which bypasses RLS
-- Replace with properly validated policy that checks required fields and prevents abuse

-- Drop all existing INSERT policies on demo_requests
DROP POLICY IF EXISTS "Anyone can submit demo request" ON public.demo_requests;
DROP POLICY IF EXISTS "Anyone can submit demo requests" ON public.demo_requests;
DROP POLICY IF EXISTS "Public can submit demo requests" ON public.demo_requests;
DROP POLICY IF EXISTS "Public can submit demo requests with validation" ON public.demo_requests;
DROP POLICY IF EXISTS "anon_can_submit_demo_requests" ON public.demo_requests;

-- Create a single, properly validated INSERT policy
CREATE POLICY "Validated demo request submission"
ON public.demo_requests 
FOR INSERT 
TO anon, authenticated
WITH CHECK (
  -- Ensure all required fields are present and not empty
  email IS NOT NULL AND 
  trim(email) <> '' AND
  email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' AND  -- Basic email validation
  name IS NOT NULL AND 
  trim(name) <> '' AND
  length(trim(name)) >= 2 AND  -- Minimum name length
  business_type IS NOT NULL AND
  trim(business_type) <> '' AND
  -- Limit message length to prevent abuse
  (message IS NULL OR length(message) <= 5000)
);

COMMENT ON POLICY "Validated demo request submission" ON public.demo_requests IS 'Allows public demo request submissions with proper field validation to prevent abuse';
