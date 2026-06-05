-- Fix: Ensure update_updated_at_column trigger function has fixed search_path
-- This function was flagged for having a role mutable search_path
-- Trigger functions should have explicit search_path to prevent unexpected behavior

-- Ensure there's a single, properly configured version
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_updated_at_column() IS 'Trigger function to automatically update the updated_at timestamp with fixed search_path';
