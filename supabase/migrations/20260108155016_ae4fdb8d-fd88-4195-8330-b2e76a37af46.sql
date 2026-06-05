-- Option 1: Create the ai_messages table if it's needed for the Cece flow
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- Policy: users can read messages from conversations in their organization
CREATE POLICY "Users can read messages from their org conversations"
ON public.ai_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.ai_conversations c
    JOIN public.profiles p ON p.organization_id = c.organization_id
    WHERE c.id = ai_messages.conversation_id
    AND p.id = auth.uid()
  )
);

-- Policy: system/triggers can insert messages
CREATE POLICY "System can insert messages"
ON public.ai_messages FOR INSERT
WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON public.ai_messages(created_at);