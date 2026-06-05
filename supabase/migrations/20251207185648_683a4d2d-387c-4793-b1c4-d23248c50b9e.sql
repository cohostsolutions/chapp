-- Create function to update timestamps if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create table for website lead capture / demo requests
CREATE TABLE IF NOT EXISTS public.demo_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  business_type TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for public form submission)
DROP POLICY IF EXISTS "Anyone can submit demo request" ON public.demo_requests;
CREATE POLICY "Anyone can submit demo request" 
ON public.demo_requests 
FOR INSERT 
WITH CHECK (true);

-- Only authenticated super admins can view demo requests
DROP POLICY IF EXISTS "Super admins can view demo requests" ON public.demo_requests;
CREATE POLICY "Super admins can view demo requests" 
ON public.demo_requests 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- Super admins can update demo requests
DROP POLICY IF EXISTS "Super admins can update demo requests" ON public.demo_requests;
CREATE POLICY "Super admins can update demo requests" 
ON public.demo_requests 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_demo_requests_updated_at ON public.demo_requests;
CREATE TRIGGER update_demo_requests_updated_at
BEFORE UPDATE ON public.demo_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();