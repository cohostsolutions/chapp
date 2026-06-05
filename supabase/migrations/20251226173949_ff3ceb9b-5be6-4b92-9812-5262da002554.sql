-- Training System Migration
-- This migration adds tables for AI training modules, sessions, and rubric templates

-- Add training columns to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS training_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS training_pii_redaction BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS training_retention_days INTEGER DEFAULT NULL;

-- Create training_modules table
CREATE TABLE IF NOT EXISTS public.training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  industry TEXT DEFAULT 'general',
  difficulty TEXT DEFAULT 'medium',
  persona JSONB NOT NULL DEFAULT '{}',
  objectives TEXT[] NOT NULL DEFAULT '{}',
  rubric JSONB NOT NULL DEFAULT '[]',
  visibility TEXT NOT NULL DEFAULT 'active',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create training_sessions table
CREATE TABLE IF NOT EXISTS public.training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  transcript JSONB NOT NULL DEFAULT '[]',
  evaluation JSONB,
  score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rubric_templates table
CREATE TABLE IF NOT EXISTS public.rubric_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  rubric JSONB NOT NULL DEFAULT '[]',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all training tables
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_templates ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_training_modules_org ON public.training_modules(organization_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_org ON public.training_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_module ON public.training_sessions(module_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_user ON public.training_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_rubric_templates_org ON public.rubric_templates(organization_id);

-- RLS Policies for training_modules
DROP POLICY IF EXISTS "Super admins manage all training_modules" ON public.training_modules;
CREATE POLICY "Super admins manage all training_modules"
  ON public.training_modules FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Client admins manage org training_modules" ON public.training_modules;
CREATE POLICY "Client admins manage org training_modules"
  ON public.training_modules FOR ALL
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users view org training_modules" ON public.training_modules;
CREATE POLICY "Users view org training_modules"
  ON public.training_modules FOR SELECT
  USING (organization_id = get_user_org(auth.uid()));

-- RLS Policies for training_sessions
DROP POLICY IF EXISTS "Super admins manage all training_sessions" ON public.training_sessions;
CREATE POLICY "Super admins manage all training_sessions"
  ON public.training_sessions FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Client admins manage org training_sessions" ON public.training_sessions;
CREATE POLICY "Client admins manage org training_sessions"
  ON public.training_sessions FOR ALL
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own training_sessions" ON public.training_sessions;
CREATE POLICY "Users can insert their own training_sessions"
  ON public.training_sessions FOR INSERT
  WITH CHECK (organization_id = get_user_org(auth.uid()) AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own training_sessions" ON public.training_sessions;
CREATE POLICY "Users can view their own training_sessions"
  ON public.training_sessions FOR SELECT
  USING (organization_id = get_user_org(auth.uid()) AND (user_id = auth.uid() OR has_role(auth.uid(), 'client_admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));

-- RLS Policies for rubric_templates
DROP POLICY IF EXISTS "Super admins manage all rubric_templates" ON public.rubric_templates;
CREATE POLICY "Super admins manage all rubric_templates"
  ON public.rubric_templates FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Client admins manage org rubric_templates" ON public.rubric_templates;
CREATE POLICY "Client admins manage org rubric_templates"
  ON public.rubric_templates FOR ALL
  USING (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Users view org rubric_templates" ON public.rubric_templates;
CREATE POLICY "Users view org rubric_templates"
  ON public.rubric_templates FOR SELECT
  USING (organization_id = get_user_org(auth.uid()));

-- Create updated_at triggers (idempotent)
DROP TRIGGER IF EXISTS update_training_modules_updated_at ON public.training_modules;
CREATE TRIGGER update_training_modules_updated_at
  BEFORE UPDATE ON public.training_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_rubric_templates_updated_at ON public.rubric_templates;
CREATE TRIGGER update_rubric_templates_updated_at
  BEFORE UPDATE ON public.rubric_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create training_stats function for analytics
CREATE OR REPLACE FUNCTION public.training_stats(
  p_org_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  total_sessions INT;
  avg_score NUMERIC;
  top_modules JSONB;
  agent_breakdown JSONB;
BEGIN
  -- Get total sessions count
  SELECT COUNT(*) INTO total_sessions
  FROM training_sessions ts
  WHERE ts.organization_id = p_org_id
    AND (p_start_date IS NULL OR ts.started_at >= p_start_date)
    AND (p_end_date IS NULL OR ts.started_at <= p_end_date)
    AND (p_user_id IS NULL OR ts.user_id = p_user_id);

  -- Get average score
  SELECT AVG(ts.score) INTO avg_score
  FROM training_sessions ts
  WHERE ts.organization_id = p_org_id
    AND ts.score IS NOT NULL
    AND (p_start_date IS NULL OR ts.started_at >= p_start_date)
    AND (p_end_date IS NULL OR ts.started_at <= p_end_date)
    AND (p_user_id IS NULL OR ts.user_id = p_user_id);

  -- Get top modules
  SELECT COALESCE(jsonb_agg(m ORDER BY m.count DESC), '[]'::jsonb) INTO top_modules
  FROM (
    SELECT 
      tm.id,
      tm.title,
      COUNT(ts.id) as count,
      AVG(ts.score) as "avgScore"
    FROM training_modules tm
    LEFT JOIN training_sessions ts ON ts.module_id = tm.id
      AND (p_start_date IS NULL OR ts.started_at >= p_start_date)
      AND (p_end_date IS NULL OR ts.started_at <= p_end_date)
      AND (p_user_id IS NULL OR ts.user_id = p_user_id)
    WHERE tm.organization_id = p_org_id
    GROUP BY tm.id, tm.title
    ORDER BY COUNT(ts.id) DESC
    LIMIT 5
  ) m;

  -- Get agent breakdown
  SELECT COALESCE(jsonb_agg(a ORDER BY a.sessions DESC), '[]'::jsonb) INTO agent_breakdown
  FROM (
    SELECT 
      ts.user_id as id,
      COALESCE(p.full_name, p.email) as name,
      COUNT(ts.id) as sessions,
      AVG(ts.score) as "avgScore"
    FROM training_sessions ts
    LEFT JOIN profiles p ON p.id = ts.user_id
    WHERE ts.organization_id = p_org_id
      AND (p_start_date IS NULL OR ts.started_at >= p_start_date)
      AND (p_end_date IS NULL OR ts.started_at <= p_end_date)
      AND (p_user_id IS NULL OR ts.user_id = p_user_id)
    GROUP BY ts.user_id, p.full_name, p.email
    ORDER BY COUNT(ts.id) DESC
  ) a;

  -- Build result
  result := jsonb_build_object(
    'totalSessions', total_sessions,
    'avgScore', avg_score,
    'topModules', top_modules,
    'agentBreakdown', agent_breakdown
  );

  RETURN result;
END;
$$;