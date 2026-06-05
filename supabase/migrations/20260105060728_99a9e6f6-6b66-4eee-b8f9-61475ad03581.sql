-- Add price_per_night column to room_units table
ALTER TABLE public.room_units 
ADD COLUMN price_per_night DECIMAL(10,2) DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN public.room_units.price_per_night IS 'Nightly rate for the room unit';