-- Add category column to room_units table
ALTER TABLE public.room_units 
ADD COLUMN IF NOT EXISTS category text;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_room_units_category ON public.room_units(category);