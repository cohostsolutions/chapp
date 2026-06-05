-- Safe version: Updates the function logic and search_path in place
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp_from_communication()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ language 'plpgsql' SET search_path = public;