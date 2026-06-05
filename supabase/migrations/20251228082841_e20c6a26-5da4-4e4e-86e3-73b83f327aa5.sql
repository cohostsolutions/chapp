-- Add guest information and source tracking columns to calendar_sync_events
ALTER TABLE public.calendar_sync_events
ADD COLUMN IF NOT EXISTS guest_name text,
ADD COLUMN IF NOT EXISTS guest_phone text,
ADD COLUMN IF NOT EXISTS guest_email text,
ADD COLUMN IF NOT EXISTS guest_count integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS source_platform text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS calendar_name text,
ADD COLUMN IF NOT EXISTS raw_description text;

-- Add index for source_platform for faster filtering
CREATE INDEX IF NOT EXISTS idx_calendar_sync_events_source_platform 
ON public.calendar_sync_events(source_platform);

-- Add comment explaining the columns
COMMENT ON COLUMN public.calendar_sync_events.guest_name IS 'Guest name parsed from event title/description';
COMMENT ON COLUMN public.calendar_sync_events.guest_phone IS 'Guest phone number parsed from event description';
COMMENT ON COLUMN public.calendar_sync_events.guest_email IS 'Guest email parsed from event description';
COMMENT ON COLUMN public.calendar_sync_events.guest_count IS 'Number of guests for the booking';
COMMENT ON COLUMN public.calendar_sync_events.source_platform IS 'Detected source platform: airbnb, booking_com, vrbo, google, manual, unknown';
COMMENT ON COLUMN public.calendar_sync_events.calendar_name IS 'User-friendly name for the calendar source';
COMMENT ON COLUMN public.calendar_sync_events.raw_description IS 'Original event description for manual info extraction';