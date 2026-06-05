-- Allow anonymous users to insert demo requests (public lead capture form)
CREATE POLICY "Anyone can submit demo requests"
ON public.demo_requests
FOR INSERT
WITH CHECK (true);