-- ============================================
-- Create missing tables for full feature set
-- ============================================

-- 1. Calendar Events table (for internal calendar management)
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  location TEXT,
  event_type TEXT DEFAULT 'meeting',
  related_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  related_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  external_calendar_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Communications table (for tracking all communications)
CREATE TABLE IF NOT EXISTS public.communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  channel TEXT NOT NULL, -- 'email', 'sms', 'call', 'chat', 'messenger', 'whatsapp', 'instagram'
  direction TEXT NOT NULL, -- 'inbound', 'outbound'
  subject TEXT,
  content TEXT,
  status TEXT DEFAULT 'sent', -- 'draft', 'sent', 'delivered', 'read', 'failed'
  external_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Message Templates table
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL, -- 'email', 'sms', 'chat'
  subject TEXT,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb, -- ['{{name}}', '{{company}}']
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Workflows table
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- 'lead_created', 'status_changed', 'temperature_changed', 'scheduled'
  trigger_config JSONB DEFAULT '{}'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of action steps
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  run_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Workflow Runs table (execution history)
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  trigger_data JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  steps_completed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 6. Reports table (saved report configurations)
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL, -- 'leads', 'sales', 'performance', 'custom'
  config JSONB NOT NULL DEFAULT '{}'::jsonb, -- filters, columns, grouping, etc.
  schedule TEXT, -- cron expression for scheduled reports
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. User Sessions table (for session management)
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT,
  location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Calendar Events Policies
CREATE POLICY "Users can view calendar events in their organization" ON public.calendar_events
  FOR SELECT USING (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users can create calendar events in their organization" ON public.calendar_events
  FOR INSERT WITH CHECK (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users can update calendar events in their organization" ON public.calendar_events
  FOR UPDATE USING (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users can delete calendar events in their organization" ON public.calendar_events
  FOR DELETE USING (organization_id = get_user_org(auth.uid()));

-- Communications Policies
DROP POLICY IF EXISTS "Users can view communications in their organization" ON public.communications;
CREATE POLICY "Users can view communications in their organization" ON public.communications
  FOR SELECT USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can create communications in their organization" ON public.communications;
CREATE POLICY "Users can create communications in their organization" ON public.communications
  FOR INSERT WITH CHECK (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can update communications in their organization" ON public.communications;
CREATE POLICY "Users can update communications in their organization" ON public.communications
  FOR UPDATE USING (organization_id = get_user_org(auth.uid()));

-- Message Templates Policies
DROP POLICY IF EXISTS "Users can view message templates in their organization" ON public.message_templates;
CREATE POLICY "Users can view message templates in their organization" ON public.message_templates
  FOR SELECT USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Client admins manage org message templates" ON public.message_templates;
CREATE POLICY "Client admins manage org message templates" ON public.message_templates
  FOR ALL USING (has_role(auth.uid(), 'client_admin') AND organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Super admins manage all message templates" ON public.message_templates;
CREATE POLICY "Super admins manage all message templates" ON public.message_templates
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- Workflows Policies
DROP POLICY IF EXISTS "Users can view workflows in their organization" ON public.workflows;
CREATE POLICY "Users can view workflows in their organization" ON public.workflows
  FOR SELECT USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Client admins manage org workflows" ON public.workflows;
CREATE POLICY "Client admins manage org workflows" ON public.workflows
  FOR ALL USING (has_role(auth.uid(), 'client_admin') AND organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Super admins manage all workflows" ON public.workflows;
CREATE POLICY "Super admins manage all workflows" ON public.workflows
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- Workflow Runs Policies
DROP POLICY IF EXISTS "Users can view workflow runs in their organization" ON public.workflow_runs;
CREATE POLICY "Users can view workflow runs in their organization" ON public.workflow_runs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.workflows w 
    WHERE w.id = workflow_runs.workflow_id 
    AND w.organization_id = get_user_org(auth.uid())
  ));

-- Reports Policies
DROP POLICY IF EXISTS "Users can view reports in their organization" ON public.reports;
CREATE POLICY "Users can view reports in their organization" ON public.reports
  FOR SELECT USING (organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Client admins manage org reports" ON public.reports;
CREATE POLICY "Client admins manage org reports" ON public.reports
  FOR ALL USING (has_role(auth.uid(), 'client_admin') AND organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Super admins manage all reports" ON public.reports;
CREATE POLICY "Super admins manage all reports" ON public.reports
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- User Sessions Policies
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;
CREATE POLICY "Users can view their own sessions" ON public.user_sessions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.user_sessions;
CREATE POLICY "Users can delete their own sessions" ON public.user_sessions
  FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Super admins can view all sessions" ON public.user_sessions;
CREATE POLICY "Super admins can view all sessions" ON public.user_sessions
  FOR SELECT USING (has_role(auth.uid(), 'super_admin'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_org ON public.calendar_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_time ON public.calendar_events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_communications_org ON public.communications(organization_id);
CREATE INDEX IF NOT EXISTS idx_communications_lead ON public.communications(lead_id);
CREATE INDEX IF NOT EXISTS idx_communications_created ON public.communications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflows_org ON public.workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON public.workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions(is_active, expires_at);

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_communications_updated_at ON public.communications;
CREATE TRIGGER update_communications_updated_at
  BEFORE UPDATE ON public.communications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_message_templates_updated_at ON public.message_templates;
CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflows_updated_at ON public.workflows;
CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_reports_updated_at ON public.reports;
CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();