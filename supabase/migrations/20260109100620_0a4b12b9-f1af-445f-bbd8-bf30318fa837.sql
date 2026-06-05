-- Add platform_user_id column to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS platform_user_id TEXT;

-- Create index for efficient lookups by platform_user_id
CREATE INDEX IF NOT EXISTS idx_leads_platform_user_id 
ON public.leads(organization_id, platform_user_id);

-- Migrate existing data: move platform IDs from phone to platform_user_id
-- Platform IDs are typically long numeric strings (15+ digits) without phone formatting
UPDATE public.leads
SET 
  platform_user_id = phone,
  phone = NULL
WHERE phone IS NOT NULL 
  AND phone ~ '^\d{15,}$'  -- Matches 15+ digit numbers (Meta PSIDs are typically 16+ digits)
  AND phone !~ '^\+?\d{10,14}$';  -- Excludes valid phone formats

-- Add a unique constraint for org + platform_user_id lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_org_platform_user_id_unique 
ON public.leads(organization_id, platform_user_id) 
WHERE platform_user_id IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.leads.platform_user_id IS 'Platform-specific user identifier (e.g., Meta PSID for Facebook/Instagram). Not a phone number.';