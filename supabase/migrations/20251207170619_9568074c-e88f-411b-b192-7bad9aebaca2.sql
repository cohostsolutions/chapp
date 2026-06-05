-- Create a message buffer table for batching incoming messages
CREATE TABLE IF NOT EXISTS public.message_buffer (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  message_text TEXT NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT false
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_message_buffer_unprocessed ON public.message_buffer (conversation_id, processed, received_at) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_message_buffer_sender ON public.message_buffer (sender_id, platform, processed);

-- Enable RLS
ALTER TABLE public.message_buffer ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (webhook edge function)
DROP POLICY IF EXISTS "Service role only" ON public.message_buffer;
CREATE POLICY "Service role only" ON public.message_buffer
  FOR ALL USING (false);

-- Auto-cleanup old processed messages (keep buffer lean)
CREATE OR REPLACE FUNCTION cleanup_old_message_buffer()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.message_buffer
  WHERE processed = true AND received_at < now() - interval '1 hour';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_message_buffer ON public.message_buffer;
CREATE TRIGGER trigger_cleanup_message_buffer
AFTER INSERT ON public.message_buffer
FOR EACH STATEMENT
EXECUTE FUNCTION cleanup_old_message_buffer();