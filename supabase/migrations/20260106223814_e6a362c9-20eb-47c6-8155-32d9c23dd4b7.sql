-- Enable realtime for operational_expenses table
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.operational_expenses;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;