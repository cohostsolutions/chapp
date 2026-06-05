-- Fix team chat creation failing RLS by removing dependency on get_user_org()

-- TEAM CHATS: allow users to create chats in their own organization
DROP POLICY IF EXISTS "Authenticated users can create chats in their org" ON public.team_chats;

CREATE POLICY "Authenticated users can create chats in their org"
ON public.team_chats
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND organization_id = (
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
  AND (
    chat_type IN ('direct', 'helpdesk')
    OR has_role(auth.uid(), 'client_admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);

-- TEAM CHAT MEMBERS: allow chat creator to add members during chat creation
DROP POLICY IF EXISTS "Users can add members to chats" ON public.team_chat_members;

CREATE POLICY "Chat creators/admins can add members"
ON public.team_chat_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- The creator of the chat can add members (including themselves)
  EXISTS (
    SELECT 1
    FROM public.team_chats c
    WHERE c.id = chat_id
      AND c.created_by = auth.uid()
      AND c.organization_id = (
        SELECT p.organization_id
        FROM public.profiles p
        WHERE p.id = auth.uid()
      )
  )
  OR is_chat_admin(auth.uid(), chat_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);
