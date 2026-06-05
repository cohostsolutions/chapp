-- Add image_urls column to offerings table for multiple photos per offering
-- This enables May (restaurant) and Jay (sales) organizations to add photo galleries

DO $$ BEGIN
  ALTER TABLE public.offerings ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Create index for image_urls array
CREATE INDEX IF NOT EXISTS idx_offerings_image_urls ON public.offerings USING GIN(image_urls);

-- Migrate existing image_url to image_urls array
UPDATE public.offerings
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL);

-- Comment
COMMENT ON COLUMN public.offerings.image_urls IS 'Array of image URLs for offering photo gallery (similar to room_units.image_urls)';
