-- Add default_country_code to organizations table
ALTER TABLE public.organizations
ADD COLUMN default_country_code text DEFAULT '+1';

-- Add comment for documentation
COMMENT ON COLUMN public.organizations.default_country_code IS 'Default country code to prepend to local phone numbers (e.g., +1 for US, +63 for PH)';