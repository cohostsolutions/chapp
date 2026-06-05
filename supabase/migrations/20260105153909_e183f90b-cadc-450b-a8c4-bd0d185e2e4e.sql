-- Add unique constraint on ai_messages external_id to prevent duplicate message inserts
-- This helps with the race condition where multiple workers try to save the same message
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_messages_external_id_unique 
ON public.ai_messages (external_id) 
WHERE external_id IS NOT NULL;