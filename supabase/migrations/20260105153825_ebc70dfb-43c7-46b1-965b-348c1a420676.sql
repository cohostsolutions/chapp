-- Add unique constraint on leads to prevent duplicate leads from race conditions
-- This ensures only one lead per organization+phone+source combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_org_phone_source_unique 
ON public.leads (organization_id, phone, source) 
WHERE phone IS NOT NULL;