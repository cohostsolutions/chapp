-- Add role column to communications table to store message role (user/assistant/agent)
DO $$ BEGIN
  ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS role text;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;