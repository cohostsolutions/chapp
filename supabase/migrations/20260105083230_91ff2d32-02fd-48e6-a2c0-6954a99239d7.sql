
-- Drop overly restrictive policies and create simpler ones that work for all authenticated users

-- Drop existing INSERT policies for team_chats
DROP POLICY IF EXISTS "Agents can create direct chats in their org" ON public.team_chats;
DROP POLICY IF EXISTS "Client admins can create chats in their org" ON public.team_chats;

-- Create a single, simpler INSERT policy for team_chats
-- Any authenticated user can create chats in their organization
CREATE POLICY "Authenticated users can create chats in their org"
ON public.team_chats
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_org(auth.uid()) 
  AND created_by = auth.uid()
);

-- Ensure the team_chat_members INSERT policy allows adding yourself when creating a chat
DROP POLICY IF EXISTS "Chat admins can manage members" ON public.team_chat_members;

CREATE POLICY "Users can add members to chats"
ON public.team_chat_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- You can add yourself to a chat you're creating
  (user_id = auth.uid())
  OR
  -- Or you're an admin of the chat
  is_chat_admin(auth.uid(), chat_id)
  OR
  -- Or you're a super admin
  has_role(auth.uid(), 'super_admin'::app_role)
);
