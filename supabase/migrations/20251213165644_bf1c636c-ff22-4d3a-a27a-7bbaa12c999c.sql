-- Add display_order column to offerings table
DO $$ BEGIN
  ALTER TABLE public.offerings ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Add display_order column to room_units table
DO $$ BEGIN
  ALTER TABLE public.room_units ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Create indexes for efficient ordering
CREATE INDEX IF NOT EXISTS idx_offerings_display_order ON public.offerings(organization_id, display_order);
CREATE INDEX IF NOT EXISTS idx_room_units_display_order ON public.room_units(organization_id, display_order);

-- Initialize display_order based on created_at for existing records
UPDATE public.offerings SET display_order = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at) as row_num
  FROM public.offerings
) as subquery
WHERE public.offerings.id = subquery.id;

UPDATE public.room_units SET display_order = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at) as row_num
  FROM public.room_units
) as subquery
WHERE public.room_units.id = subquery.id;