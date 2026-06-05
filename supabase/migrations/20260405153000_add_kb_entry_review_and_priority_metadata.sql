ALTER TABLE public.knowledge_base_entries
  ADD COLUMN IF NOT EXISTS source_priority TEXT NOT NULL DEFAULT 'canonical',
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS reviewed_by_name TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'knowledge_base_entries_source_priority_check'
  ) THEN
    ALTER TABLE public.knowledge_base_entries
      ADD CONSTRAINT knowledge_base_entries_source_priority_check
      CHECK (source_priority IN ('canonical', 'supporting', 'reference'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_knowledge_base_entries_source_priority
  ON public.knowledge_base_entries (organization_id, source_priority);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_entries_reviewed_at
  ON public.knowledge_base_entries (organization_id, reviewed_at);