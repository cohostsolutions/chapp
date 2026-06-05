-- Ensure the new column exists without failing if already present
ALTER TABLE public.room_units
  ADD COLUMN IF NOT EXISTS calendar_ids TEXT[] DEFAULT '{}';

-- Migrate data from legacy column and drop it, only if it still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'room_units'
      AND column_name = 'calendar_id'
  ) THEN
    UPDATE public.room_units
    SET calendar_ids = ARRAY[calendar_id]
    WHERE calendar_id IS NOT NULL AND calendar_id != '';

    ALTER TABLE public.room_units
      DROP COLUMN IF EXISTS calendar_id;
  END IF;
END $$;