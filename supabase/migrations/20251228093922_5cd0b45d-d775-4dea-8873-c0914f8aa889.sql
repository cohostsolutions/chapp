DO $$
BEGIN
	-- Add column only if it does not already exist (idempotent in preview/prod)
	IF NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'organizations'
			AND column_name = 'ai_opening_message'
	) THEN
		ALTER TABLE public.organizations
		ADD COLUMN ai_opening_message TEXT DEFAULT NULL;
	END IF;

	-- Keep column documentation up to date if column is present
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'organizations'
			AND column_name = 'ai_opening_message'
	) THEN
		COMMENT ON COLUMN public.organizations.ai_opening_message IS 'Custom opening message for AI agents. If null, default greeting is used.';
	END IF;
END $$;