-- Create analytics_events table for tracking user interactions
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  event_action TEXT NOT NULL,
  event_label TEXT,
  event_value NUMERIC,
  page_path TEXT,
  user_agent TEXT,
  ip_address TEXT,
  session_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_category_action ON public.analytics_events(event_category, event_action);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts for tracking (no auth required for tracking events)
DROP POLICY IF EXISTS "Allow anonymous insert analytics events" ON public.analytics_events;

CREATE POLICY "Allow anonymous insert analytics events"
ON public.analytics_events
FOR INSERT
WITH CHECK (true);

-- Only super admins can view analytics
DROP POLICY IF EXISTS "Super admins can view analytics events" ON public.analytics_events;

CREATE POLICY "Super admins can view analytics events"
ON public.analytics_events
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));