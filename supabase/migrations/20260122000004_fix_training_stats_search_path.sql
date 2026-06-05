-- Fix: Ensure training_stats function has fixed search_path
-- This function was flagged for having a role mutable search_path
-- SECURITY DEFINER functions must have explicit SET search_path to prevent privilege escalation

DROP FUNCTION IF EXISTS public.training_stats(uuid, timestamptz, timestamptz, uuid);

CREATE OR REPLACE FUNCTION public.training_stats(
  p_org_id uuid,
  p_start_date timestamptz default null,
  p_end_date timestamptz default null,
  p_user_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total integer;
  avg_score numeric;
  top jsonb;
  agents jsonb;
BEGIN
  -- Apply filters
  SELECT COUNT(*), AVG(score) 
  INTO total, avg_score 
  FROM public.training_sessions 
  WHERE organization_id = p_org_id
    AND (p_start_date IS NULL OR started_at >= p_start_date)
    AND (p_end_date IS NULL OR started_at <= p_end_date)
    AND (p_user_id IS NULL OR user_id = p_user_id);

  -- Top modules
  top := (
    SELECT jsonb_agg(row_to_json(t)) FROM (
      SELECT module_id AS id,
             (SELECT title FROM public.training_modules m WHERE m.id = s.module_id) AS title,
             COUNT(*) AS count,
             AVG(score) AS avg_score
      FROM public.training_sessions s
      WHERE s.organization_id = p_org_id
        AND (p_start_date IS NULL OR s.started_at >= p_start_date)
        AND (p_end_date IS NULL OR s.started_at <= p_end_date)
        AND (p_user_id IS NULL OR s.user_id = p_user_id)
      GROUP BY module_id
      ORDER BY count DESC
      LIMIT 5
    ) t
  );

  -- Agent breakdown
  agents := (
    SELECT jsonb_agg(row_to_json(a)) FROM (
      SELECT s.user_id AS id,
             (SELECT full_name FROM public.profiles p WHERE p.id = s.user_id) AS name,
             COUNT(*) AS sessions,
             AVG(s.score) AS avg_score
      FROM public.training_sessions s
      WHERE s.organization_id = p_org_id
        AND (p_start_date IS NULL OR s.started_at >= p_start_date)
        AND (p_end_date IS NULL OR s.started_at <= p_end_date)
        AND (p_user_id IS NULL OR s.user_id = p_user_id)
      GROUP BY s.user_id
      ORDER BY avg_score DESC NULLS LAST
      LIMIT 10
    ) a
  );

  RETURN jsonb_build_object(
    'totalSessions', COALESCE(total, 0),
    'avgScore', avg_score,
    'topModules', COALESCE(top, '[]'::jsonb),
    'agentBreakdown', COALESCE(agents, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.training_stats(uuid, timestamptz, timestamptz, uuid) IS 'Calculate training statistics with fixed search_path to prevent privilege escalation';
