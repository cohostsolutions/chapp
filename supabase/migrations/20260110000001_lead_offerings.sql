-- Create lead_offerings junction table for Many-to-Many relationship
CREATE TABLE IF NOT EXISTS public.lead_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  offering_id UUID NOT NULL REFERENCES public.offerings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(lead_id, offering_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_lead_offerings_lead_id ON public.lead_offerings(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_offerings_offering_id ON public.lead_offerings(offering_id);

-- Enable RLS
ALTER TABLE public.lead_offerings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lead_offerings
DROP POLICY IF EXISTS "Users can view lead offerings in their organization" ON public.lead_offerings;

CREATE POLICY "Users can view lead offerings in their organization"
  ON public.lead_offerings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = lead_offerings.lead_id
      AND leads.organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert lead offerings in their organization" ON public.lead_offerings;

CREATE POLICY "Users can insert lead offerings in their organization"
  ON public.lead_offerings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = lead_offerings.lead_id
      AND leads.organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update lead offerings in their organization" ON public.lead_offerings;

CREATE POLICY "Users can update lead offerings in their organization"
  ON public.lead_offerings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = lead_offerings.lead_id
      AND leads.organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete lead offerings in their organization" ON public.lead_offerings;

CREATE POLICY "Users can delete lead offerings in their organization"
  ON public.lead_offerings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = lead_offerings.lead_id
      AND leads.organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

COMMENT ON TABLE public.lead_offerings IS 'Junction table for Many-to-Many relationship between leads and offerings';
