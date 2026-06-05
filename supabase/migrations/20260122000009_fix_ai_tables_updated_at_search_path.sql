-- Fix: Ensure update_ai_tables_updated_at trigger function has fixed search_path
-- This function was flagged for having a role mutable search_path
-- Trigger functions should have explicit search_path to prevent unexpected behavior

CREATE OR REPLACE FUNCTION public.update_ai_tables_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_ai_tables_updated_at() IS 'Trigger function to automatically update updated_at timestamp for AI-related tables with fixed search_path';
