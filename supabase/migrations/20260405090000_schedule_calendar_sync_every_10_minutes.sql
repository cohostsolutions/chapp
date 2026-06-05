CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'sync-calendar-events-every-10-minutes';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'sync-calendar-events-every-10-minutes',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/sync-calendar-events',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"source":"pg_cron"}'::jsonb
  ) AS request_id;
  $$
);