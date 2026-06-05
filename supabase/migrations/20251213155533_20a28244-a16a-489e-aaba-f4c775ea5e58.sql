-- Create webhook health tracking table
CREATE TABLE IF NOT EXISTS public.webhook_health (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform text NOT NULL,
  platform_id uuid REFERENCES public.social_platforms(id) ON DELETE CASCADE,
  last_webhook_at timestamp with time zone,
  last_message_at timestamp with time zone,
  webhooks_received_24h integer NOT NULL DEFAULT 0,
  messages_processed_24h integer NOT NULL DEFAULT 0,
  errors_24h integer NOT NULL DEFAULT 0,
  last_error text,
  last_error_at timestamp with time zone,
  status text NOT NULL DEFAULT 'unknown',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(platform_id)
);

-- Enable RLS
ALTER TABLE public.webhook_health ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all webhook health records
DROP POLICY IF EXISTS "Super admins manage webhook_health" ON public.webhook_health;

CREATE POLICY "Super admins manage webhook_health" 
ON public.webhook_health 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Client admins can view their org's webhook health
DROP POLICY IF EXISTS "Client admins view org webhook_health" ON public.webhook_health;

CREATE POLICY "Client admins view org webhook_health" 
ON public.webhook_health 
FOR SELECT 
USING (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()));

-- Service role can manage all records
DROP POLICY IF EXISTS "Service role manages webhook_health" ON public.webhook_health;

CREATE POLICY "Service role manages webhook_health" 
ON public.webhook_health 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_webhook_health_updated_at ON public.webhook_health;

CREATE TRIGGER update_webhook_health_updated_at
BEFORE UPDATE ON public.webhook_health
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_webhook_health_platform_id ON public.webhook_health(platform_id);
CREATE INDEX IF NOT EXISTS idx_webhook_health_organization_id ON public.webhook_health(organization_id);