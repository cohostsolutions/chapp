-- Create table to store synced Google Calendar events for room availability
CREATE TABLE IF NOT EXISTS public.calendar_sync_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  room_unit_id UUID NOT NULL REFERENCES room_units(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL,
  google_event_id TEXT NOT NULL,
  title TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  all_day BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(calendar_id, google_event_id)
);

-- Enable RLS
ALTER TABLE public.calendar_sync_events ENABLE ROW LEVEL SECURITY;

-- Policies: service role can manage, org users can view
DROP POLICY IF EXISTS "Service role manages calendar_sync_events" ON public.calendar_sync_events;
CREATE POLICY "Service role manages calendar_sync_events"
ON public.calendar_sync_events
FOR ALL
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Users view org calendar_sync_events" ON public.calendar_sync_events;
CREATE POLICY "Users view org calendar_sync_events"
ON public.calendar_sync_events
FOR SELECT
USING (organization_id = get_user_org(auth.uid()));

-- Create index for efficient availability queries
CREATE INDEX IF NOT EXISTS idx_calendar_sync_events_room_dates 
ON public.calendar_sync_events(room_unit_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_calendar_sync_events_org_dates
ON public.calendar_sync_events(organization_id, start_time, end_time);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_calendar_sync_events_updated_at ON public.calendar_sync_events;
CREATE TRIGGER update_calendar_sync_events_updated_at
BEFORE UPDATE ON public.calendar_sync_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for this table
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_sync_events;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;