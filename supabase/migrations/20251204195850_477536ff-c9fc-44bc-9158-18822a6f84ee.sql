-- AI Conversations table (synced from Jay AI)
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  external_id TEXT, -- ID from Jay AI service
  platform TEXT NOT NULL DEFAULT 'web', -- web, facebook, whatsapp, instagram
  status TEXT NOT NULL DEFAULT 'active', -- active, ended, archived
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI Messages within conversations
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL, -- user, assistant, system
  content TEXT NOT NULL,
  external_id TEXT, -- ID from Jay AI service
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Social Platforms configuration per organization
CREATE TABLE IF NOT EXISTS public.social_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL, -- facebook, whatsapp, instagram
  display_name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  credentials JSONB DEFAULT '{}', -- encrypted credentials/tokens
  webhook_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, platform)
);

-- Knowledge Base entries (manual Q&A pairs, articles)
CREATE TABLE IF NOT EXISTS public.knowledge_base_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Knowledge Base documents (uploaded files)
CREATE TABLE IF NOT EXISTS public.knowledge_base_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, ready, error
  extracted_text TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_documents ENABLE ROW LEVEL SECURITY;

-- AI Conversations policies
DROP POLICY IF EXISTS "Super admins manage all ai_conversations" ON public.ai_conversations;
CREATE POLICY "Super admins manage all ai_conversations"
ON public.ai_conversations FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Org users view ai_conversations" ON public.ai_conversations;
CREATE POLICY "Org users view ai_conversations"
ON public.ai_conversations FOR SELECT
USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Client admins manage org ai_conversations" ON public.ai_conversations;
CREATE POLICY "Client admins manage org ai_conversations"
ON public.ai_conversations FOR ALL
USING (has_role(auth.uid(), 'client_admin') AND organization_id = get_user_org(auth.uid()));

-- AI Messages policies
DROP POLICY IF EXISTS "Super admins manage all ai_messages" ON public.ai_messages;
CREATE POLICY "Super admins manage all ai_messages"
ON public.ai_messages FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Org users view ai_messages" ON public.ai_messages;
CREATE POLICY "Org users view ai_messages"
ON public.ai_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.ai_conversations 
  WHERE ai_conversations.id = ai_messages.conversation_id 
  AND ai_conversations.organization_id = get_user_org(auth.uid())
));

-- Social Platforms policies
DROP POLICY IF EXISTS "Super admins manage all social_platforms" ON public.social_platforms;
CREATE POLICY "Super admins manage all social_platforms"
ON public.social_platforms FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Client admins manage org social_platforms" ON public.social_platforms;
CREATE POLICY "Client admins manage org social_platforms"
ON public.social_platforms FOR ALL
USING (has_role(auth.uid(), 'client_admin') AND organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Org users view social_platforms" ON public.social_platforms;
CREATE POLICY "Org users view social_platforms"
ON public.social_platforms FOR SELECT
USING (organization_id = get_user_org(auth.uid()));

-- Knowledge Base Entries policies
DROP POLICY IF EXISTS "Super admins manage all knowledge_base_entries" ON public.knowledge_base_entries;
CREATE POLICY "Super admins manage all knowledge_base_entries"
ON public.knowledge_base_entries FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Client admins manage org knowledge_base_entries" ON public.knowledge_base_entries;
CREATE POLICY "Client admins manage org knowledge_base_entries"
ON public.knowledge_base_entries FOR ALL
USING (has_role(auth.uid(), 'client_admin') AND organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Org users view knowledge_base_entries" ON public.knowledge_base_entries;
CREATE POLICY "Org users view knowledge_base_entries"
ON public.knowledge_base_entries FOR SELECT
USING (organization_id = get_user_org(auth.uid()));

-- Knowledge Base Documents policies
DROP POLICY IF EXISTS "Super admins manage all knowledge_base_documents" ON public.knowledge_base_documents;
CREATE POLICY "Super admins manage all knowledge_base_documents"
ON public.knowledge_base_documents FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Client admins manage org knowledge_base_documents" ON public.knowledge_base_documents;
CREATE POLICY "Client admins manage org knowledge_base_documents"
ON public.knowledge_base_documents FOR ALL
USING (has_role(auth.uid(), 'client_admin') AND organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Org users view knowledge_base_documents" ON public.knowledge_base_documents;
CREATE POLICY "Org users view knowledge_base_documents"
ON public.knowledge_base_documents FOR SELECT
USING (organization_id = get_user_org(auth.uid()));

-- Create storage bucket for knowledge base documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('knowledge-base', 'knowledge-base', false)
ON CONFLICT (id) DO NOTHING;

-- Note: Storage bucket policies for knowledge-base must be configured
-- directly in the Supabase dashboard under Storage > Policies.
-- storage.objects is a Supabase-managed system table and cannot be modified via migrations.

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER update_ai_conversations_updated_at
BEFORE UPDATE ON public.ai_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_social_platforms_updated_at ON public.social_platforms;
CREATE TRIGGER update_social_platforms_updated_at
BEFORE UPDATE ON public.social_platforms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_knowledge_base_entries_updated_at ON public.knowledge_base_entries;
CREATE TRIGGER update_knowledge_base_entries_updated_at
BEFORE UPDATE ON public.knowledge_base_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_knowledge_base_documents_updated_at ON public.knowledge_base_documents;
CREATE TRIGGER update_knowledge_base_documents_updated_at
BEFORE UPDATE ON public.knowledge_base_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();