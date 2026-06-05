-- Add database indexes for performance optimization

-- Leads table indexes
CREATE INDEX IF NOT EXISTS idx_leads_organization_id ON public.leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_lead_temperature ON public.leads(lead_temperature);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_agent_id ON public.leads(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_org_status ON public.leads(organization_id, status);

-- AI Conversations indexes
CREATE INDEX IF NOT EXISTS idx_ai_conversations_organization_id ON public.ai_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_lead_id ON public.ai_conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_status ON public.ai_conversations(status);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at ON public.ai_conversations(created_at DESC);

-- AI Messages indexes
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON public.ai_messages(created_at DESC);

-- Orders indexes (for May)
CREATE INDEX IF NOT EXISTS idx_orders_organization_id ON public.orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_lead_id ON public.orders(lead_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- Bookings indexes (for Cece)
CREATE INDEX IF NOT EXISTS idx_bookings_organization_id ON public.bookings(organization_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room_unit_id ON public.bookings(room_unit_id);
CREATE INDEX IF NOT EXISTS idx_bookings_lead_id ON public.bookings(lead_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_check_in ON public.bookings(check_in);

-- Knowledge base indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_base_entries_organization_id ON public.knowledge_base_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_entries_is_active ON public.knowledge_base_entries(is_active);

-- Call logs index
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON public.call_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON public.call_logs(created_at DESC);

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);