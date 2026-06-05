-- 1. Create a helper function to check if a user is assigned to a lead
CREATE OR REPLACE FUNCTION public.is_assigned_to_lead(_user_id uuid, _lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads
    WHERE id = _lead_id
      AND assigned_agent_id = _user_id
  )
$$;

-- 2. Drop the overly permissive "Org users view" policy for ai_conversations
DROP POLICY IF EXISTS "Org users view ai_conversations" ON public.ai_conversations;

-- 3. Create a more restrictive policy: agents only see conversations for their assigned leads
CREATE POLICY "Users view authorized ai_conversations" 
ON public.ai_conversations 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid())) OR
  (has_role(auth.uid(), 'agent'::app_role) AND is_assigned_to_lead(auth.uid(), lead_id))
);