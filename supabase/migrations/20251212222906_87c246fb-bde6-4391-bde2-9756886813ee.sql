-- Create health_check_thresholds table for configurable alert thresholds
CREATE TABLE IF NOT EXISTS public.health_check_thresholds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  threshold_name TEXT NOT NULL UNIQUE,
  warning_value INTEGER NOT NULL,
  critical_value INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.health_check_thresholds ENABLE ROW LEVEL SECURITY;

-- Only super admins can view/modify thresholds
DROP POLICY IF EXISTS "Super admins can manage health thresholds" ON public.health_check_thresholds;
CREATE POLICY "Super admins can manage health thresholds"
ON public.health_check_thresholds
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Create health_check_history table to store health check results
CREATE TABLE IF NOT EXISTS public.health_check_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  overall_status TEXT NOT NULL CHECK (overall_status IN ('healthy', 'warning', 'critical')),
  health_score INTEGER NOT NULL DEFAULT 100,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  overdue_secrets INTEGER NOT NULL DEFAULT 0,
  table_sizes JSONB,
  processing_backlog INTEGER NOT NULL DEFAULT 0,
  alerts_sent BOOLEAN NOT NULL DEFAULT false,
  check_details JSONB
);

-- Enable RLS
ALTER TABLE public.health_check_history ENABLE ROW LEVEL SECURITY;

-- Only super admins can view health history
DROP POLICY IF EXISTS "Super admins can view health history" ON public.health_check_history;
CREATE POLICY "Super admins can view health history"
ON public.health_check_history
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

-- Insert policy for service role (edge functions)
DROP POLICY IF EXISTS "Service role can insert health history" ON public.health_check_history;
CREATE POLICY "Service role can insert health history"
ON public.health_check_history
FOR INSERT
WITH CHECK (true);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_health_check_thresholds_updated_at ON public.health_check_thresholds;
CREATE TRIGGER update_health_check_thresholds_updated_at
BEFORE UPDATE ON public.health_check_thresholds
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default thresholds
INSERT INTO public.health_check_thresholds (threshold_name, warning_value, critical_value, description)
VALUES 
  ('failed_logins_24h', 20, 50, 'Failed login attempts in the last 24 hours'),
  ('overdue_secrets', 1, 3, 'Number of secrets overdue for rotation'),
  ('table_row_count', 100000, 500000, 'Maximum row count per table before alerting'),
  ('query_duration_ms', 2000, 5000, 'Database query duration in milliseconds'),
  ('processing_backlog', 10, 50, 'Unprocessed messages older than 1 hour'),
  ('health_score', 70, 50, 'Overall health score percentage (below triggers alert)')
ON CONFLICT (threshold_name) DO NOTHING;