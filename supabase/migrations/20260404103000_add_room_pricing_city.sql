ALTER TABLE public.room_units
ADD COLUMN IF NOT EXISTS pricing_city text;

COMMENT ON COLUMN public.room_units.pricing_city IS
'Optional city override used for accommodation dynamic pricing market segmentation.';