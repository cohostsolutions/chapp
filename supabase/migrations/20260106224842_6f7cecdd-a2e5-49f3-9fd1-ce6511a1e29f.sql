-- Enable realtime for ai_messages and ai_conversations tables
-- This allows new messages and conversation updates to push to the UI in real-time

-- Add ai_messages to realtime publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add ai_conversations to realtime publication  
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_conversations;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;