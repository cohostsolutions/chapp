-- Add first_message_sender to training modules (who starts the chat)
ALTER TABLE public.training_modules
ADD COLUMN IF NOT EXISTS first_message_sender text;

-- Backfill existing rows
UPDATE public.training_modules
SET first_message_sender = COALESCE(first_message_sender, 'ai');

-- Defaults + constraints
ALTER TABLE public.training_modules
ALTER COLUMN first_message_sender SET DEFAULT 'ai';

ALTER TABLE public.training_modules
ALTER COLUMN first_message_sender SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'training_modules_first_message_sender_check'
  ) THEN
    ALTER TABLE public.training_modules
      ADD CONSTRAINT training_modules_first_message_sender_check
      CHECK (first_message_sender IN ('ai', 'trainee'));
  END IF;
END $$;
