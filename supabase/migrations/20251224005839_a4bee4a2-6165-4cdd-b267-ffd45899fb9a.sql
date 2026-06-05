-- Add language configuration columns to organizations table (idempotent)
DO $$
BEGIN
	ALTER TABLE public.organizations
	ADD COLUMN allowed_languages text[] NOT NULL DEFAULT ARRAY['en']::text[];
EXCEPTION
	WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
	ALTER TABLE public.organizations
	ADD COLUMN language_lock_enabled boolean NOT NULL DEFAULT true;
EXCEPTION
	WHEN duplicate_column THEN NULL;
END $$;

-- Update existing GuilCor and CoHost Solutions organizations to be exempt from language lock
UPDATE public.organizations 
SET language_lock_enabled = false 
WHERE name ILIKE '%guilcor%' OR name ILIKE '%cohost solutions%';