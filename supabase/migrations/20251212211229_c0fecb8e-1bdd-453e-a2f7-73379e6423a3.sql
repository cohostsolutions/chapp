-- Enable realtime for communications table
ALTER TABLE public.communications REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.communications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;