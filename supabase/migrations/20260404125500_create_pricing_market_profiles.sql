CREATE TABLE IF NOT EXISTS public.pricing_market_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('country', 'region', 'city', 'district')),
  country text,
  region text,
  city text,
  district text,
  multiplier numeric(6, 3) NOT NULL,
  market_positioning text NOT NULL,
  adjustment_label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_market_profiles_org_scope
ON public.pricing_market_profiles(organization_id, scope, display_order);

ALTER TABLE public.pricing_market_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view pricing_market_profiles in their organization" ON public.pricing_market_profiles;
CREATE POLICY "Users can view pricing_market_profiles in their organization"
ON public.pricing_market_profiles
FOR SELECT
USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can create pricing_market_profiles in their organization" ON public.pricing_market_profiles;
CREATE POLICY "Users can create pricing_market_profiles in their organization"
ON public.pricing_market_profiles
FOR INSERT
WITH CHECK (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can update pricing_market_profiles in their organization" ON public.pricing_market_profiles;
CREATE POLICY "Users can update pricing_market_profiles in their organization"
ON public.pricing_market_profiles
FOR UPDATE
USING (organization_id = get_user_org(auth.uid()))
WITH CHECK (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Admins delete pricing_market_profiles in their organization" ON public.pricing_market_profiles;
CREATE POLICY "Admins delete pricing_market_profiles in their organization"
ON public.pricing_market_profiles
FOR DELETE
USING (
  organization_id = get_user_org(auth.uid())
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'client_admin'::app_role)
  )
);

DROP TRIGGER IF EXISTS update_pricing_market_profiles_updated_at ON public.pricing_market_profiles;
CREATE TRIGGER update_pricing_market_profiles_updated_at
BEFORE UPDATE ON public.pricing_market_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();