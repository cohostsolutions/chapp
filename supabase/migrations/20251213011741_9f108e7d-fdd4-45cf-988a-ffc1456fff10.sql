-- Add schedule fields to reports table if not already present
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS schedule_frequency text CHECK (schedule_frequency IN ('weekly', 'monthly', 'daily')),
ADD COLUMN IF NOT EXISTS schedule_day integer,
ADD COLUMN IF NOT EXISTS schedule_time time DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS last_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS recipient_emails text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_scheduled boolean DEFAULT false;

-- Create index for finding scheduled reports
CREATE INDEX IF NOT EXISTS idx_reports_scheduled ON public.reports (is_scheduled, schedule_frequency) WHERE is_scheduled = true;