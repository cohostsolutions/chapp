-- Add currency column to organizations table
ALTER TABLE public.organizations 
ADD COLUMN currency_code VARCHAR(3) NOT NULL DEFAULT 'PHP';

-- Add a comment for documentation
COMMENT ON COLUMN public.organizations.currency_code IS 'ISO 4217 currency code for the organization (e.g., PHP, USD, EUR)';