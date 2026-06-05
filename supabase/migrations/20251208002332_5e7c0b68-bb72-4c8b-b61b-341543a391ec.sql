-- Add ai_summary field to leads table for storing AI-generated summaries
DO $$ BEGIN
  ALTER TABLE public.leads ADD COLUMN ai_summary TEXT;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;