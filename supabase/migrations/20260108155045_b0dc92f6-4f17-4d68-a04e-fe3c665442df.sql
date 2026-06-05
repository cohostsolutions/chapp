-- Drop the overly permissive policy and create a more restrictive one
DROP POLICY IF EXISTS "System can insert messages" ON public.ai_messages;

-- The trigger runs with security definer context, so we need to allow inserts from authenticated users
-- or via the service role. The trigger uses the database owner context.
-- For now, let's allow inserts only if user belongs to the conversation's org
CREATE POLICY "Users can insert messages to their org conversations"
ON public.ai_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ai_conversations c
    JOIN public.profiles p ON p.organization_id = c.organization_id
    WHERE c.id = conversation_id
    AND p.id = auth.uid()
  )
);