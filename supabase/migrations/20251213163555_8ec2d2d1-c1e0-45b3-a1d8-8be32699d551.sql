-- Add image_url column to offerings table
DO $$ BEGIN
  ALTER TABLE public.offerings ADD COLUMN IF NOT EXISTS image_url text;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Add image_url column to room_units table
DO $$ BEGIN
  ALTER TABLE public.room_units ADD COLUMN IF NOT EXISTS image_url text;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Add image_url column to knowledge_base_entries table (used for menu items)
DO $$ BEGIN
  ALTER TABLE public.knowledge_base_entries ADD COLUMN IF NOT EXISTS image_url text;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Create storage bucket for item images
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO NOTHING;

-- Note: Storage bucket policies for item-images must be configured
-- directly in the Supabase dashboard under Storage > Policies.
-- storage.objects is a Supabase-managed system table and cannot be modified via migrations.