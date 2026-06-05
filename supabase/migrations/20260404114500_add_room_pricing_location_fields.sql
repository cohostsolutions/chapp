ALTER TABLE public.room_units
ADD COLUMN IF NOT EXISTS pricing_country text,
ADD COLUMN IF NOT EXISTS pricing_region text,
ADD COLUMN IF NOT EXISTS pricing_district text;

COMMENT ON COLUMN public.room_units.pricing_country IS
'Optional country override used for accommodation dynamic pricing market segmentation.';

COMMENT ON COLUMN public.room_units.pricing_region IS
'Optional region override used for accommodation dynamic pricing market segmentation.';

COMMENT ON COLUMN public.room_units.pricing_district IS
'Optional district override used for accommodation dynamic pricing market segmentation.';