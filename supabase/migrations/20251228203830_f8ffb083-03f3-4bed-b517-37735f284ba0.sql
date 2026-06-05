-- Add explicit shared access control to organizations
ALTER TABLE public.organizations 
ADD COLUMN agent_shared_access boolean NOT NULL DEFAULT true;

-- Initialize based on current logic (may/cece types had shared access)
UPDATE public.organizations 
SET agent_shared_access = (ai_agent_type IN ('may', 'cece'));

-- Update the function to use the new explicit column
CREATE OR REPLACE FUNCTION public.org_uses_shared_access(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT agent_shared_access FROM public.organizations WHERE id = _org_id),
    false
  )
$$;