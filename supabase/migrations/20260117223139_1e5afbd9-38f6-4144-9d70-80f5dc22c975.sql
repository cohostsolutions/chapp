-- ============================================================================
-- AI COMMUNICATION ENHANCEMENTS - Database Migration
-- Creates 12 new tables for enhanced AI communication system
-- ============================================================================

-- 1. Lead Engagement Profiles
CREATE TABLE IF NOT EXISTS public.lead_engagement_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  communication_style TEXT DEFAULT 'neutral' CHECK (communication_style IN ('quick_responses', 'detailed_info', 'visual', 'text', 'neutral')),
  response_speed_avg_minutes INTEGER,
  topics_discussed JSONB DEFAULT '[]'::jsonb,
  abandoned_topics JSONB DEFAULT '[]'::jsonb,
  objections_history JSONB DEFAULT '[]'::jsonb,
  interaction_count INTEGER DEFAULT 0,
  last_interaction TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lead_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_engagement_profiles_lead_id ON public.lead_engagement_profiles(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_engagement_profiles_org_id ON public.lead_engagement_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_engagement_profiles_updated_at ON public.lead_engagement_profiles(updated_at DESC);

ALTER TABLE public.lead_engagement_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view engagement profiles in their org"
  ON public.lead_engagement_profiles FOR SELECT TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users can insert engagement profiles in their org"
  ON public.lead_engagement_profiles FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users can update engagement profiles in their org"
  ON public.lead_engagement_profiles FOR UPDATE TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users can delete engagement profiles in their org"
  ON public.lead_engagement_profiles FOR DELETE TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

-- 2. Conversation Metadata
CREATE TABLE IF NOT EXISTS public.conversation_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  topics_extracted JSONB DEFAULT '{}'::jsonb,
  key_information JSONB DEFAULT '{}'::jsonb,
  sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative', 'frustrated')),
  confidence_score NUMERIC(3,2) DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_metadata_conv_id ON public.conversation_metadata(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_metadata_lead_id ON public.conversation_metadata(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversation_metadata_sentiment ON public.conversation_metadata(sentiment);
CREATE INDEX IF NOT EXISTS idx_conversation_metadata_created_at ON public.conversation_metadata(created_at DESC);

ALTER TABLE public.conversation_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view conversation metadata in their org"
  ON public.conversation_metadata FOR SELECT TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users can manage conversation metadata in their org"
  ON public.conversation_metadata FOR ALL TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

-- 3. Lead Qualification Scores
CREATE TABLE IF NOT EXISTS public.lead_qualification_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  scoring_breakdown JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'hot_lead', 'booked', 'lost')),
  status_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lead_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_qual_scores_lead_id ON public.lead_qualification_scores(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_qual_scores_status ON public.lead_qualification_scores(status);
CREATE INDEX IF NOT EXISTS idx_lead_qual_scores_score ON public.lead_qualification_scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_lead_qual_scores_org_status ON public.lead_qualification_scores(organization_id, status);

ALTER TABLE public.lead_qualification_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view qualification scores in their org"
  ON public.lead_qualification_scores FOR SELECT TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users can manage qualification scores in their org"
  ON public.lead_qualification_scores FOR ALL TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

-- 4. Qualification Events
CREATE TABLE IF NOT EXISTS public.qualification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('budget_confirmed', 'timeline_known', 'decision_maker_identified', 'interest_expressed', 'objection_raised', 'positive_sentiment', 'engagement_velocity_high', 'engagement_velocity_low')),
  event_value JSONB DEFAULT '{}'::jsonb,
  score_impact INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qual_events_lead_id ON public.qualification_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_qual_events_event_type ON public.qualification_events(event_type);
CREATE INDEX IF NOT EXISTS idx_qual_events_created_at ON public.qualification_events(created_at DESC);

ALTER TABLE public.qualification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view qualification events in their org"
  ON public.qualification_events FOR SELECT TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users can manage qualification events in their org"
  ON public.qualification_events FOR ALL TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

-- 5. Re-engagement Campaigns
CREATE TABLE IF NOT EXISTS public.re_engagement_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('budget_objection', 'time_objection', 'feature_interest', 'generic')),
  message_sent TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  response_received BOOLEAN DEFAULT false,
  response_time_minutes INTEGER,
  attempt_number INTEGER DEFAULT 1,
  escalated_to_agent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reengagement_lead_id ON public.re_engagement_campaigns(lead_id);
CREATE INDEX IF NOT EXISTS idx_reengagement_sent_at ON public.re_engagement_campaigns(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_reengagement_campaign_type ON public.re_engagement_campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS idx_reengagement_response ON public.re_engagement_campaigns(response_received);

ALTER TABLE public.re_engagement_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view re-engagement campaigns in their org"
  ON public.re_engagement_campaigns FOR SELECT TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users can manage re-engagement campaigns in their org"
  ON public.re_engagement_campaigns FOR ALL TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

-- 6. Re-engagement Templates
CREATE TABLE IF NOT EXISTS public.re_engagement_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('budget_objection', 'time_objection', 'feature_interest', 'generic')),
  template_text TEXT NOT NULL,
  trigger_conditions JSONB DEFAULT '{}'::jsonb,
  success_rate NUMERIC(5,2) DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reengagement_templates_org_type ON public.re_engagement_templates(organization_id, campaign_type);
CREATE INDEX IF NOT EXISTS idx_reengagement_templates_enabled ON public.re_engagement_templates(is_enabled);
CREATE INDEX IF NOT EXISTS idx_reengagement_templates_success ON public.re_engagement_templates(success_rate DESC);

ALTER TABLE public.re_engagement_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view re-engagement templates in their org"
  ON public.re_engagement_templates FOR SELECT TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users can manage re-engagement templates in their org"
  ON public.re_engagement_templates FOR ALL TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

-- 7. Handoff Events
CREATE TABLE IF NOT EXISTS public.handoff_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  trigger_reason TEXT NOT NULL CHECK (trigger_reason IN ('cant_answer', 'high_score', 'sentiment_drop', 'request_agent', 'timeout')),
  handoff_data JSONB DEFAULT '{}'::jsonb,
  assigned_to_agent UUID,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handoff_events_lead_id ON public.handoff_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_handoff_events_agent ON public.handoff_events(assigned_to_agent);
CREATE INDEX IF NOT EXISTS idx_handoff_events_completed ON public.handoff_events(completed);
CREATE INDEX IF NOT EXISTS idx_handoff_events_created_at ON public.handoff_events(created_at DESC);

ALTER TABLE public.handoff_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view handoff events in their org"
  ON public.handoff_events FOR SELECT TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users can manage handoff events in their org"
  ON public.handoff_events FOR ALL TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

-- 8. Knowledge Base Performance
CREATE TABLE IF NOT EXISTS public.knowledge_base_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_article_id UUID NOT NULL REFERENCES public.knowledge_base_entries(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shown_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  converted_count INTEGER DEFAULT 0,
  click_through_rate NUMERIC(5,2) DEFAULT 0,
  conversion_rate NUMERIC(5,2) DEFAULT 0,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(kb_article_id)
);

CREATE INDEX IF NOT EXISTS idx_kb_performance_article ON public.knowledge_base_performance(kb_article_id);
CREATE INDEX IF NOT EXISTS idx_kb_performance_conversion ON public.knowledge_base_performance(conversion_rate DESC);
CREATE INDEX IF NOT EXISTS idx_kb_performance_shown ON public.knowledge_base_performance(shown_count DESC);
CREATE INDEX IF NOT EXISTS idx_kb_performance_last_used ON public.knowledge_base_performance(last_used DESC);

ALTER TABLE public.knowledge_base_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view KB performance in their org"
  ON public.knowledge_base_performance FOR SELECT TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users can manage KB performance in their org"
  ON public.knowledge_base_performance FOR ALL TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

-- 9. Knowledge Base Versions
CREATE TABLE IF NOT EXISTS public.knowledge_base_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_article_id UUID NOT NULL REFERENCES public.knowledge_base_entries(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  changed_fields JSONB DEFAULT '[]'::jsonb,
  change_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_versions_article ON public.knowledge_base_versions(kb_article_id);
CREATE INDEX IF NOT EXISTS idx_kb_versions_created_at ON public.knowledge_base_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_versions_article_version ON public.knowledge_base_versions(kb_article_id, version_number DESC);

ALTER TABLE public.knowledge_base_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view KB versions in their org"
  ON public.knowledge_base_versions FOR SELECT TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users can manage KB versions in their org"
  ON public.knowledge_base_versions FOR ALL TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

-- 10. AI Performance Metrics
CREATE TABLE IF NOT EXISTS public.ai_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('response_time', 'confidence', 'sentiment', 'engagement_rate', 'conversion_rate', 're_engagement_success')),
  metric_value NUMERIC(10,4) NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_metrics_type ON public.ai_performance_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_recorded_at ON public.ai_performance_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_type_recorded ON public.ai_performance_metrics(metric_type, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_org_type_recorded ON public.ai_performance_metrics(organization_id, metric_type, recorded_at DESC);

ALTER TABLE public.ai_performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view performance metrics in their org"
  ON public.ai_performance_metrics FOR SELECT TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users can manage performance metrics in their org"
  ON public.ai_performance_metrics FOR ALL TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

-- 11. AI Analytics Snapshots
CREATE TABLE IF NOT EXISTS public.ai_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_snapshots_date ON public.ai_analytics_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_snapshots_org_date ON public.ai_analytics_snapshots(organization_id, snapshot_date DESC);

ALTER TABLE public.ai_analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analytics snapshots in their org"
  ON public.ai_analytics_snapshots FOR SELECT TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users can manage analytics snapshots in their org"
  ON public.ai_analytics_snapshots FOR ALL TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

-- 12. AI Alert Rules
CREATE TABLE IF NOT EXISTS public.ai_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  condition JSONB NOT NULL,
  alert_to_user_id UUID,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_alert_rules_org ON public.ai_alert_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_alert_rules_enabled ON public.ai_alert_rules(is_enabled);
CREATE INDEX IF NOT EXISTS idx_ai_alert_rules_user ON public.ai_alert_rules(alert_to_user_id);

ALTER TABLE public.ai_alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view AI alert rules in their org"
  ON public.ai_alert_rules FOR SELECT TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users can manage AI alert rules in their org"
  ON public.ai_alert_rules FOR ALL TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

-- 13. AI Alert History
CREATE TABLE IF NOT EXISTS public.ai_alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id UUID REFERENCES public.ai_alert_rules(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_alert_history_rule ON public.ai_alert_history(alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_ai_alert_history_org ON public.ai_alert_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_alert_history_created_at ON public.ai_alert_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_alert_history_acknowledged ON public.ai_alert_history(acknowledged);

ALTER TABLE public.ai_alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view AI alert history in their org"
  ON public.ai_alert_history FOR SELECT TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

CREATE POLICY "Users can manage AI alert history in their org"
  ON public.ai_alert_history FOR ALL TO authenticated
  USING (organization_id = get_user_org(auth.uid()));

-- Helper function: Find dormant leads for re-engagement
CREATE OR REPLACE FUNCTION public.find_dormant_leads(
  p_org_id UUID,
  p_threshold_time TIMESTAMPTZ
)
RETURNS TABLE(lead_id UUID) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id as lead_id
  FROM leads l
  LEFT JOIN ai_conversations ac ON ac.lead_id = l.id
  WHERE l.organization_id = p_org_id
    AND l.is_ai_managed = true
    AND l.status NOT IN ('converted', 'lost')
    AND (l.updated_at < p_threshold_time OR l.updated_at IS NULL)
    AND NOT EXISTS (
      SELECT 1 FROM re_engagement_campaigns rec 
      WHERE rec.lead_id = l.id 
      AND rec.attempt_number >= 3
    )
$$;

-- Trigger function for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_ai_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lead_engagement_profiles_updated_at
  BEFORE UPDATE ON public.lead_engagement_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_ai_tables_updated_at();

CREATE TRIGGER update_conversation_metadata_updated_at
  BEFORE UPDATE ON public.conversation_metadata
  FOR EACH ROW EXECUTE FUNCTION public.update_ai_tables_updated_at();

CREATE TRIGGER update_lead_qualification_scores_updated_at
  BEFORE UPDATE ON public.lead_qualification_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_ai_tables_updated_at();

CREATE TRIGGER update_re_engagement_templates_updated_at
  BEFORE UPDATE ON public.re_engagement_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_ai_tables_updated_at();

CREATE TRIGGER update_kb_performance_updated_at
  BEFORE UPDATE ON public.knowledge_base_performance
  FOR EACH ROW EXECUTE FUNCTION public.update_ai_tables_updated_at();

CREATE TRIGGER update_ai_alert_rules_updated_at
  BEFORE UPDATE ON public.ai_alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_ai_tables_updated_at();