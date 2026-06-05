CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE TABLE IF NOT EXISTS private.internal_job_secrets (
  job_name text PRIMARY KEY,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE private.internal_job_secrets FROM PUBLIC;

INSERT INTO private.internal_job_secrets (job_name, secret)
VALUES ('cleanup-training-retention', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (job_name) DO NOTHING;

CREATE OR REPLACE FUNCTION private.get_internal_job_secret(p_job_name text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = private
AS $$
  SELECT secret
  FROM private.internal_job_secrets
  WHERE job_name = p_job_name;
$$;

CREATE OR REPLACE FUNCTION public.is_valid_internal_job_secret(p_job_name text, p_secret text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM private.internal_job_secrets
    WHERE job_name = p_job_name
      AND secret = p_secret
      AND p_secret IS NOT NULL
      AND btrim(p_secret) <> ''
  );
$$;

REVOKE ALL ON FUNCTION private.get_internal_job_secret(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_valid_internal_job_secret(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_internal_job_secret(text, text) TO service_role;

CREATE INDEX IF NOT EXISTS idx_training_sessions_org_ended_at
ON public.training_sessions (organization_id, ended_at)
WHERE ended_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_training_sessions_org_started_at_when_open
ON public.training_sessions (organization_id, started_at)
WHERE ended_at IS NULL;

CREATE OR REPLACE FUNCTION public.cleanup_training_sessions_by_retention()
RETURNS TABLE (
  organization_id uuid,
  retention_days integer,
  deleted_sessions bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_record RECORD;
  deleted_count bigint;
  cutoff timestamptz;
BEGIN
  FOR org_record IN
    SELECT id, training_retention_days
    FROM public.organizations
    WHERE training_enabled = true
      AND training_retention_days IS NOT NULL
      AND training_retention_days > 0
  LOOP
    cutoff := now() - make_interval(days => org_record.training_retention_days);

    WITH deleted AS (
      DELETE FROM public.training_sessions ts
      WHERE ts.organization_id = org_record.id
        AND (
          ts.ended_at < cutoff
          OR (ts.ended_at IS NULL AND ts.started_at < cutoff)
        )
      RETURNING 1
    )
    SELECT COUNT(*) INTO deleted_count
    FROM deleted;

    organization_id := org_record.id;
    retention_days := org_record.training_retention_days;
    deleted_sessions := COALESCE(deleted_count, 0);
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_training_sessions_by_retention() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_training_sessions_by_retention() TO service_role;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'cleanup-training-retention-daily';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-training-retention-daily',
  '15 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/cleanup-training-retention',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-scheduler-secret', private.get_internal_job_secret('cleanup-training-retention')
    ),
    body := '{"source":"pg_cron"}'::jsonb
  ) AS request_id;
  $$
);