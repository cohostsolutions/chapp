-- Create a function to update parent conversation's updated_at when a message is inserted
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.ai_conversations
  SET updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update conversation timestamp on new message insert
CREATE TRIGGER update_conversation_on_message_insert
AFTER INSERT ON public.ai_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_timestamp();

-- Also create a function to update conversation timestamp from communications
-- This handles agent communications which should also update the conversation activity
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp_from_communication()
RETURNS TRIGGER AS $$
BEGIN
  -- Find the conversation for this lead and update its timestamp
  UPDATE public.ai_conversations
  SET updated_at = NEW.created_at
  WHERE id = (
    SELECT id FROM public.ai_conversations
    WHERE lead_id = NEW.lead_id
    ORDER BY updated_at DESC
    LIMIT 1
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update conversation timestamp on new communication insert
CREATE TRIGGER update_conversation_on_communication_insert
AFTER INSERT ON public.communications
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_timestamp_from_communication();

