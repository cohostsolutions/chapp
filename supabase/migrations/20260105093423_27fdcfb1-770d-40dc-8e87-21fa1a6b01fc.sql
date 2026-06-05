-- Add calendar_sources JSONB field to room_units
-- Maps each calendar_id to its source platform (e.g., {"calendar_id": "airbnb"})
ALTER TABLE public.room_units 
ADD COLUMN IF NOT EXISTS calendar_sources JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.room_units.calendar_sources IS 'Maps each calendar_id to its source platform (airbnb, booking_com, vrbo, expedia, agoda, direct, facebook, manual)';