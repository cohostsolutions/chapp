-- Add image_urls column to room_units for multiple images
DO $$ BEGIN
  ALTER TABLE public.room_units ADD COLUMN image_urls text[] DEFAULT '{}';
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Migrate existing single image_url to the new array
UPDATE public.room_units 
SET image_urls = ARRAY[image_url] 
WHERE image_url IS NOT NULL AND image_url != '';