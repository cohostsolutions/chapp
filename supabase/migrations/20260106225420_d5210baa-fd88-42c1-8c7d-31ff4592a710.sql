-- Fix 1: Add unique constraints to prevent duplicate messages at DB level

-- Add unique constraint on ai_messages using external_id (message ID from Facebook)
-- This prevents the same message from being inserted multiple times
CREATE UNIQUE INDEX IF NOT EXISTS ai_messages_external_id_unique 
ON public.ai_messages (external_id) 
WHERE external_id IS NOT NULL;

-- Add unique constraint on communications using external_id
CREATE UNIQUE INDEX IF NOT EXISTS communications_external_id_unique 
ON public.communications (external_id) 
WHERE external_id IS NOT NULL;

-- Fix 2: Clean up orphaned data

-- Delete communications without lead_id (4 records found)
DELETE FROM public.communications WHERE lead_id IS NULL;

-- Delete empty conversations (conversations with no messages)
DELETE FROM public.ai_conversations 
WHERE id IN (
  SELECT c.id 
  FROM public.ai_conversations c
  LEFT JOIN public.ai_messages m ON m.conversation_id = c.id
  WHERE m.id IS NULL
);

-- Fix 3: Add a processed_external_ids table for webhook idempotency
CREATE TABLE IF NOT EXISTS public.webhook_processed_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL,
  platform text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_processed_messages_external_id_platform_unique UNIQUE (external_id, platform)
);

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS webhook_processed_messages_external_id_idx 
ON public.webhook_processed_messages (external_id, platform);

-- Add cleanup function to prevent table bloat (keep last 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.webhook_processed_messages
  WHERE processed_at < now() - interval '7 days';
END;
$$;

-- Enable RLS on the new table
ALTER TABLE public.webhook_processed_messages ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions use service role)
CREATE POLICY "Service role full access" ON public.webhook_processed_messages
FOR ALL USING (true) WITH CHECK (true);