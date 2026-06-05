-- Create message_reactions table for storing emoji reactions on communications
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  communication_id uuid NOT NULL REFERENCES public.communications(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Prevent duplicate reactions (same user, same emoji, same message)
  UNIQUE (communication_id, emoji, user_id)
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_message_reactions_communication_id ON public.message_reactions(communication_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON public.message_reactions(user_id);

-- Enable Row Level Security
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies using security definer functions (following project patterns)

-- Users can view reactions in their organization
CREATE POLICY "Users view org reactions"
ON public.message_reactions
FOR SELECT
USING (organization_id = get_user_org(auth.uid()));

-- Users can add reactions in their organization
CREATE POLICY "Users add org reactions"
ON public.message_reactions
FOR INSERT
WITH CHECK (organization_id = get_user_org(auth.uid()) AND user_id = auth.uid());

-- Users can only delete their own reactions
CREATE POLICY "Users delete own reactions"
ON public.message_reactions
FOR DELETE
USING (organization_id = get_user_org(auth.uid()) AND user_id = auth.uid());

-- Super admins manage all reactions in their org
CREATE POLICY "Super admins manage org reactions"
ON public.message_reactions
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) AND NOT is_impersonating(auth.uid()) AND organization_id = get_user_org(auth.uid()));

-- Client admins manage all reactions in their org  
CREATE POLICY "Client admins manage org reactions"
ON public.message_reactions
FOR ALL
USING (has_role(auth.uid(), 'client_admin'::app_role) AND NOT has_role(auth.uid(), 'super_admin'::app_role) AND organization_id = get_user_org(auth.uid()));