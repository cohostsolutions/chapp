-- Add is_archived column to organizations table
DO $$ BEGIN
  ALTER TABLE public.organizations ADD COLUMN is_archived boolean NOT NULL DEFAULT false;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_organizations_is_archived ON public.organizations(is_archived);