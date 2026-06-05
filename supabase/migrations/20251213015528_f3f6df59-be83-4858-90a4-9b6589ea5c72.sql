-- Create IP blocklist table
CREATE TABLE IF NOT EXISTS public.ip_blocklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  list_type TEXT NOT NULL DEFAULT 'block' CHECK (list_type IN ('block', 'allow')),
  reason TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_blocked BOOLEAN NOT NULL DEFAULT false,
  blocked_email TEXT,
  failed_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index on IP address
CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_blocklist_ip ON public.ip_blocklist(ip_address);

-- Create index for active blocks
CREATE INDEX IF NOT EXISTS idx_ip_blocklist_active ON public.ip_blocklist(is_active, list_type) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.ip_blocklist ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all entries
DROP POLICY IF EXISTS "Super admins manage ip_blocklist" ON public.ip_blocklist;

CREATE POLICY "Super admins manage ip_blocklist"
  ON public.ip_blocklist
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Service role can insert/update for auto-blocking
DROP POLICY IF EXISTS "Service role can manage ip_blocklist" ON public.ip_blocklist;

CREATE POLICY "Service role can manage ip_blocklist"
  ON public.ip_blocklist
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to check if IP is blocked
CREATE OR REPLACE FUNCTION public.is_ip_blocked(p_ip_address TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_allowed BOOLEAN;
  v_is_blocked BOOLEAN;
BEGIN
  -- Check if IP is in allowlist (allowlist takes priority)
  SELECT EXISTS (
    SELECT 1 FROM public.ip_blocklist
    WHERE ip_address = p_ip_address
      AND list_type = 'allow'
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_is_allowed;
  
  IF v_is_allowed THEN
    RETURN false;
  END IF;
  
  -- Check if IP is in blocklist
  SELECT EXISTS (
    SELECT 1 FROM public.ip_blocklist
    WHERE ip_address = p_ip_address
      AND list_type = 'block'
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_is_blocked;
  
  RETURN v_is_blocked;
END;
$$;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_ip_blocklist_updated_at ON public.ip_blocklist;

CREATE TRIGGER update_ip_blocklist_updated_at
  BEFORE UPDATE ON public.ip_blocklist
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();