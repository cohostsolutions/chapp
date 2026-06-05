-- Create audit_logs table for tracking sensitive operations
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON public.audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can view audit logs
DROP POLICY IF EXISTS "Super admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Super admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

-- System can insert audit logs (via service role)
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- Create secret_rotation_tracking table
CREATE TABLE IF NOT EXISTS public.secret_rotation_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_name TEXT NOT NULL UNIQUE,
  last_rotated_at TIMESTAMP WITH TIME ZONE,
  rotation_interval_days INTEGER NOT NULL DEFAULT 90,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.secret_rotation_tracking ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage secret rotation tracking
DROP POLICY IF EXISTS "Super admins can manage secret rotation" ON public.secret_rotation_tracking;
CREATE POLICY "Super admins can manage secret rotation"
ON public.secret_rotation_tracking
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Insert initial secret tracking records
INSERT INTO public.secret_rotation_tracking (secret_name, rotation_interval_days) VALUES
  ('TWILIO_ACCOUNT_SID', 90),
  ('TWILIO_AUTH_TOKEN', 90),
  ('TWILIO_PHONE_NUMBER', 365),
  ('META_APP_SECRET', 90),
  ('META_VERIFY_TOKEN', 90),
  ('GOOGLE_OAUTH_CLIENT_SECRET', 180),
  ('RESEND_API_KEY', 90),
  ('JAY_AI_WEBHOOK_SECRET', 90)
ON CONFLICT (secret_name) DO NOTHING;

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_secret_rotation_tracking_updated_at ON public.secret_rotation_tracking;
CREATE TRIGGER update_secret_rotation_tracking_updated_at
BEFORE UPDATE ON public.secret_rotation_tracking
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();