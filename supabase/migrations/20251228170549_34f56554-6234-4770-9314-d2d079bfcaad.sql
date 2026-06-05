-- Team chat types
DO $$ BEGIN
  CREATE TYPE public.chat_type AS ENUM ('direct', 'group', 'helpdesk');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Team chats table
CREATE TABLE IF NOT EXISTS public.team_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  chat_type chat_type NOT NULL DEFAULT 'direct',
  name TEXT,
  description TEXT,
  created_by UUID NOT NULL,
  is_helpdesk_channel BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Team chat members
CREATE TABLE IF NOT EXISTS public.team_chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES public.team_chats(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'admin', 'member'
  is_muted BOOLEAN DEFAULT false,
  last_read_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chat_id, user_id)
);

-- Team chat messages
CREATE TABLE IF NOT EXISTS public.team_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES public.team_chats(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID NOT NULL,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'file', 'image', 'system'
  metadata JSONB DEFAULT '{}'::jsonb, -- for attachments, reactions, etc.
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  parent_message_id UUID REFERENCES public.team_chat_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Message reactions
CREATE TABLE IF NOT EXISTS public.team_chat_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.team_chat_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Helpdesk tickets (for private escalation)
CREATE TABLE IF NOT EXISTS public.helpdesk_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  requester_id UUID NOT NULL,
  assigned_admin_id UUID,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
  priority TEXT NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  chat_id UUID REFERENCES public.team_chats(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.team_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_chat_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_tickets ENABLE ROW LEVEL SECURITY;

-- Enable realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.team_chat_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.team_chat_members;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Function to check if user is member of chat
CREATE OR REPLACE FUNCTION public.is_chat_member(_user_id UUID, _chat_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_chat_members
    WHERE chat_id = _chat_id AND user_id = _user_id
  )
$$;

-- Function to check if user is chat admin
CREATE OR REPLACE FUNCTION public.is_chat_admin(_user_id UUID, _chat_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_chat_members
    WHERE chat_id = _chat_id AND user_id = _user_id AND role = 'admin'
  )
$$;

-- RLS Policies for team_chats
DROP POLICY IF EXISTS "Users can view chats they are members of" ON public.team_chats;
DROP POLICY IF EXISTS "Client admins can create chats in their org" ON public.team_chats;
DROP POLICY IF EXISTS "Agents can create direct chats in their org" ON public.team_chats;
DROP POLICY IF EXISTS "Chat admins can update chats" ON public.team_chats;
DROP POLICY IF EXISTS "Chat admins can delete chats" ON public.team_chats;

CREATE POLICY "Users can view chats they are members of"
ON public.team_chats FOR SELECT
USING (
  is_chat_member(auth.uid(), id) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Client admins can create chats in their org"
ON public.team_chats FOR INSERT
WITH CHECK (
  organization_id = get_user_org(auth.uid()) AND
  (has_role(auth.uid(), 'client_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "Agents can create direct chats in their org"
ON public.team_chats FOR INSERT
WITH CHECK (
  organization_id = get_user_org(auth.uid()) AND
  chat_type = 'direct' AND
  has_role(auth.uid(), 'agent'::app_role)
);

CREATE POLICY "Chat admins can update chats"
ON public.team_chats FOR UPDATE
USING (
  is_chat_admin(auth.uid(), id) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Chat admins can delete chats"
ON public.team_chats FOR DELETE
USING (
  is_chat_admin(auth.uid(), id) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- RLS Policies for team_chat_members
CREATE POLICY "Members can view chat members"
ON public.team_chat_members FOR SELECT
USING (
  is_chat_member(auth.uid(), chat_id) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Chat admins can manage members"
ON public.team_chat_members FOR INSERT
WITH CHECK (
  is_chat_admin(auth.uid(), chat_id) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  (user_id = auth.uid()) -- users can add themselves to direct chats they create
);

CREATE POLICY "Chat admins can update members"
ON public.team_chat_members FOR UPDATE
USING (
  is_chat_admin(auth.uid(), chat_id) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  user_id = auth.uid() -- users can update their own membership (mute, etc.)
);

CREATE POLICY "Chat admins can remove members"
ON public.team_chat_members FOR DELETE
USING (
  is_chat_admin(auth.uid(), chat_id) OR
  has_role(auth.uid(), 'super_admin'::app_role) OR
  user_id = auth.uid() -- users can leave chats
);

-- RLS Policies for team_chat_messages
CREATE POLICY "Members can view messages"
ON public.team_chat_messages FOR SELECT
USING (
  is_chat_member(auth.uid(), chat_id) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Members can send messages"
ON public.team_chat_messages FOR INSERT
WITH CHECK (
  is_chat_member(auth.uid(), chat_id) AND
  sender_id = auth.uid()
);

CREATE POLICY "Senders can edit their messages"
ON public.team_chat_messages FOR UPDATE
USING (sender_id = auth.uid());

CREATE POLICY "Senders and admins can delete messages"
ON public.team_chat_messages FOR DELETE
USING (
  sender_id = auth.uid() OR
  is_chat_admin(auth.uid(), chat_id) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- RLS Policies for team_chat_reactions
CREATE POLICY "Members can view reactions"
ON public.team_chat_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.team_chat_messages m
    WHERE m.id = message_id AND is_chat_member(auth.uid(), m.chat_id)
  )
);

CREATE POLICY "Members can add reactions"
ON public.team_chat_reactions FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.team_chat_messages m
    WHERE m.id = message_id AND is_chat_member(auth.uid(), m.chat_id)
  )
);

CREATE POLICY "Users can remove their reactions"
ON public.team_chat_reactions FOR DELETE
USING (user_id = auth.uid());

-- RLS Policies for helpdesk_tickets
CREATE POLICY "Users can view their own tickets"
ON public.helpdesk_tickets FOR SELECT
USING (
  requester_id = auth.uid() OR
  assigned_admin_id = auth.uid() OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Users can create helpdesk tickets"
ON public.helpdesk_tickets FOR INSERT
WITH CHECK (
  requester_id = auth.uid() AND
  organization_id = get_user_org(auth.uid())
);

CREATE POLICY "Assigned admins and super admins can update tickets"
ON public.helpdesk_tickets FOR UPDATE
USING (
  assigned_admin_id = auth.uid() OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Triggers for updated_at
CREATE TRIGGER update_team_chats_updated_at
  BEFORE UPDATE ON public.team_chats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_helpdesk_tickets_updated_at
  BEFORE UPDATE ON public.helpdesk_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-attachments', 'chat-attachments', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat attachments
CREATE POLICY "Chat members can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-attachments' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Chat members can view attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-attachments' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Uploaders can delete their attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);