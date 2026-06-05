-- Twilio Multi-Tenant Support
-- Step 1: Add columns for Twilio subaccount credentials and create phone_numbers table

-- Add columns to organizations for Twilio subaccount credentials
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS twilio_subaccount_sid text,
  ADD COLUMN IF NOT EXISTS twilio_auth_token text;

-- Create phone_numbers table to track purchased numbers per organization
CREATE TABLE IF NOT EXISTS public.phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  twilio_sid TEXT,
  phone_number TEXT NOT NULL,
  country_code TEXT,
  area_code TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Org users view org phone numbers" ON public.phone_numbers;
CREATE POLICY "Org users view org phone numbers" ON public.phone_numbers
  FOR SELECT USING (organization_id = public.get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Client admins manage org phone numbers" ON public.phone_numbers;
CREATE POLICY "Client admins manage org phone numbers" ON public.phone_numbers
  FOR ALL USING (
    public.has_role(auth.uid(), 'client_admin') AND 
    organization_id = public.get_user_org(auth.uid())
  );

DROP POLICY IF EXISTS "Super admins manage all phone numbers" ON public.phone_numbers;
CREATE POLICY "Super admins manage all phone numbers" ON public.phone_numbers
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- updated_at trigger
DROP TRIGGER IF EXISTS update_phone_numbers_updated_at ON public.phone_numbers;
CREATE TRIGGER update_phone_numbers_updated_at BEFORE UPDATE ON public.phone_numbers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
