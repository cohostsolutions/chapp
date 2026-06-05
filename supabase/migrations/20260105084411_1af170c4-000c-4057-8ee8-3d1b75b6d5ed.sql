-- Allow chat creators to see newly created chats (fixes INSERT ... RETURNING under RLS)

DROP POLICY IF EXISTS "Users can view chats they are members of" ON public.team_chats;

CREATE POLICY "Users can view chats they are members of"
ON public.team_chats
FOR SELECT
TO public
USING (
  is_chat_member(auth.uid(), id)
  OR created_by = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
);
