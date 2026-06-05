-- Add image_urls column to knowledge_base_entries table for multiple photos per menu item
-- This enables May (restaurant) organizations to add photo galleries for menu items

DO $$ BEGIN
  ALTER TABLE public.knowledge_base_entries ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Create index for image_urls array
CREATE INDEX IF NOT EXISTS idx_knowledge_base_entries_image_urls ON public.knowledge_base_entries USING GIN(image_urls);

-- Migrate existing image_url to image_urls array
UPDATE public.knowledge_base_entries
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL);

-- Comment
COMMENT ON COLUMN public.knowledge_base_entries.image_urls IS 'Array of image URLs for menu item photo gallery (similar to room_units.image_urls)';
