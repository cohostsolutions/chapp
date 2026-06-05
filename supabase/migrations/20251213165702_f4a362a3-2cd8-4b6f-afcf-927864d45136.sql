-- Add display_order column to knowledge_base_entries table for menu items
DO $$ BEGIN
  ALTER TABLE public.knowledge_base_entries ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Create index for efficient ordering
CREATE INDEX IF NOT EXISTS idx_knowledge_base_entries_display_order ON public.knowledge_base_entries(organization_id, display_order);

-- Initialize display_order based on created_at for existing records
UPDATE public.knowledge_base_entries SET display_order = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at) as row_num
  FROM public.knowledge_base_entries
) as subquery
WHERE public.knowledge_base_entries.id = subquery.id;