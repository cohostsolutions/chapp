-- Add timezone column to calendar_sync_events to store the source calendar's timezone
ALTER TABLE public.calendar_sync_events 
ADD COLUMN IF NOT EXISTS calendar_timezone text DEFAULT 'UTC';

-- Add comment for clarity
COMMENT ON COLUMN public.calendar_sync_events.calendar_timezone IS 'IANA timezone of the source Google Calendar (e.g., Asia/Manila, America/New_York)';