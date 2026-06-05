-- Add unified sales process configuration field to organizations
-- This consolidates opening message, conversion criteria, and the entire sales journey
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS sales_process_config jsonb DEFAULT '{
  "opening": {
    "enabled": true,
    "message": ""
  },
  "qualification": {
    "enabled": true,
    "description": "",
    "questions": []
  },
  "conversion": {
    "reservation": { "enabled": true, "description": "", "required_info": [] },
    "sale": { "enabled": true, "description": "", "required_info": [] },
    "order": { "enabled": true, "description": "", "required_info": [] }
  },
  "confirmation": {
    "enabled": true,
    "process": ""
  },
  "after_sales": {
    "enabled": true,
    "follow_up": ""
  }
}'::jsonb;

-- Add a comment explaining the field
COMMENT ON COLUMN public.organizations.sales_process_config IS 'Unified configuration for the entire sales/booking/order process journey';