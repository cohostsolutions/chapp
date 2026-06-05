-- Fix: Ensure audit_delete_operation trigger function has fixed search_path
-- This function was flagged for having a role mutable search_path
-- SECURITY DEFINER functions must have explicit SET search_path to prevent privilege escalation

CREATE OR REPLACE FUNCTION public.audit_delete_operation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'DELETE',
    TG_TABLE_NAME,
    OLD.id::text,
    jsonb_build_object(
      'deleted_at', now(),
      'deleted_by', auth.uid(),
      'data_snapshot', to_jsonb(OLD)
    )
  );
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.audit_delete_operation() IS 'Trigger function to audit DELETE operations with fixed search_path to prevent privilege escalation';
