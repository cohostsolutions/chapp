-- Enable realtime for leads table
ALTER TABLE public.leads REPLICA IDENTITY FULL;

-- Add leads table to realtime publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;