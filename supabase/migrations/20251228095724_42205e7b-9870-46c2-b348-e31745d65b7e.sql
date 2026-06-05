-- Add conversion criteria field to organizations
-- This allows client admins to define what constitutes a reservation/sale/order confirmation
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS conversion_criteria jsonb DEFAULT '{
  "reservation": {
    "enabled": true,
    "description": "",
    "required_info": []
  },
  "sale": {
    "enabled": true,
    "description": "",
    "required_info": []
  },
  "order": {
    "enabled": true,
    "description": "",
    "required_info": []
  }
}'::jsonb;

-- Add a comment explaining the field
COMMENT ON COLUMN public.organizations.conversion_criteria IS 'Defines what constitutes a successful reservation, sale, or order confirmation for this organization';