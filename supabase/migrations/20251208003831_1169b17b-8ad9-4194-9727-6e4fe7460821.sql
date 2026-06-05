-- Create offerings table for Jay (sales) organizations
CREATE TABLE IF NOT EXISTS public.offerings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.offerings ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "Users can view offerings in their organization" ON public.offerings;
CREATE POLICY "Users can view offerings in their organization"
ON public.offerings FOR SELECT
USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can create offerings in their organization" ON public.offerings;
CREATE POLICY "Users can create offerings in their organization"
ON public.offerings FOR INSERT
WITH CHECK (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can update offerings in their organization" ON public.offerings;
CREATE POLICY "Users can update offerings in their organization"
ON public.offerings FOR UPDATE
USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can delete offerings in their organization" ON public.offerings;
CREATE POLICY "Users can delete offerings in their organization"
ON public.offerings FOR DELETE
USING (organization_id = get_user_org(auth.uid()));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_offerings_updated_at ON public.offerings;
CREATE TRIGGER update_offerings_updated_at
BEFORE UPDATE ON public.offerings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_offerings_organization_id ON public.offerings(organization_id);
CREATE INDEX IF NOT EXISTS idx_offerings_is_active ON public.offerings(is_active);