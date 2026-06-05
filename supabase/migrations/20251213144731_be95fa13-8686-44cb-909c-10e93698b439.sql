-- Create a helper function to check if an organization uses a non-sales AI agent (May or Cece)
CREATE OR REPLACE FUNCTION public.org_uses_shared_access(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id = _org_id
      AND ai_agent_type IN ('may', 'cece')
  )
$$;

-- Drop existing agent-restrictive policies for ai_conversations
DROP POLICY IF EXISTS "Users view authorized ai_conversations" ON public.ai_conversations;

-- Create new policy that allows May/Cece org agents to see all conversations in their org
CREATE POLICY "Users view authorized ai_conversations" 
ON public.ai_conversations 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()))
  OR (
    has_role(auth.uid(), 'agent'::app_role) 
    AND organization_id = get_user_org(auth.uid())
    AND (
      -- May/Cece orgs: agents see all conversations in their org
      org_uses_shared_access(organization_id)
      -- Jay orgs: agents only see conversations for assigned leads
      OR is_assigned_to_lead(auth.uid(), lead_id)
    )
  )
);

-- Drop existing agent-restrictive policies for ai_messages
DROP POLICY IF EXISTS "Users view authorized ai_messages" ON public.ai_messages;

-- Create new policy for ai_messages that respects org type
CREATE POLICY "Users view authorized ai_messages" 
ON public.ai_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM ai_conversations c
    WHERE c.id = ai_messages.conversation_id
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR (has_role(auth.uid(), 'client_admin'::app_role) AND c.organization_id = get_user_org(auth.uid()))
      OR (
        has_role(auth.uid(), 'agent'::app_role) 
        AND c.organization_id = get_user_org(auth.uid())
        AND (
          org_uses_shared_access(c.organization_id)
          OR is_assigned_to_lead(auth.uid(), c.lead_id)
        )
      )
    )
  )
);

-- Drop existing agent-restrictive policies for chat_messages
DROP POLICY IF EXISTS "Users view authorized chat messages" ON public.chat_messages;

-- Create new policy for chat_messages that respects org type
CREATE POLICY "Users view authorized chat messages" 
ON public.chat_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM leads l
    WHERE l.id = chat_messages.lead_id
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR (has_role(auth.uid(), 'client_admin'::app_role) AND l.organization_id = get_user_org(auth.uid()))
      OR (
        has_role(auth.uid(), 'agent'::app_role) 
        AND l.organization_id = get_user_org(auth.uid())
        AND (
          org_uses_shared_access(l.organization_id)
          OR l.assigned_agent_id = auth.uid()
        )
      )
    )
  )
);