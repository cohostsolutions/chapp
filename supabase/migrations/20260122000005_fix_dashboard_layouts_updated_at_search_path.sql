-- Fix: Ensure update_dashboard_layouts_updated_at trigger function has fixed search_path
-- This function was flagged for having a role mutable search_path
-- Trigger functions should have explicit search_path to prevent unexpected behavior

DROP FUNCTION IF EXISTS public.update_dashboard_layouts_updated_at();

CREATE OR REPLACE FUNCTION public.update_dashboard_layouts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_dashboard_layouts_updated_at() IS 'Trigger function to automatically update dashboard_layouts.updated_at timestamp with fixed search_path';
