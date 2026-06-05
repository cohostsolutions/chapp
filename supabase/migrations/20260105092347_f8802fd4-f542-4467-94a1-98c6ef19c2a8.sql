-- Add booking_source column to bookings table to track where the booking came from
ALTER TABLE public.bookings
ADD COLUMN booking_source TEXT DEFAULT NULL;

-- Add a comment to explain the column
COMMENT ON COLUMN public.bookings.booking_source IS 'Source platform of the booking (e.g., airbnb, booking_com, agoda, direct, facebook, manual)';

-- Create an index for filtering/reporting by source
CREATE INDEX IF NOT EXISTS idx_bookings_booking_source ON public.bookings(booking_source);

-- Update existing bookings with source from their linked calendar_sync_events
UPDATE public.bookings b
SET booking_source = cse.source_platform
FROM public.calendar_sync_events cse
WHERE b.calendar_event_id = cse.google_event_id
  AND cse.source_platform IS NOT NULL
  AND b.booking_source IS NULL;