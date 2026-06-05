-- Fix search_path for the cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_message_buffer()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.message_buffer
  WHERE processed = true AND received_at < now() - interval '1 hour';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;