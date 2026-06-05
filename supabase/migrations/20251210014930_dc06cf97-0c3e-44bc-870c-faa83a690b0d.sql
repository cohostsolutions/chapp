-- Create rate_limits table for edge function rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

-- Enable RLS on rate_limits (service role only)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access rate_limits
DROP POLICY IF EXISTS "Service role only for rate_limits" ON public.rate_limits;
CREATE POLICY "Service role only for rate_limits"
ON public.rate_limits
FOR ALL
USING (false);

-- Atomic increment function: increments count for (key, window_start) and returns the new count
CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_key text,
  p_window_start timestamptz,
  p_increment int
)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_count int;
BEGIN
  LOOP
    -- Try to update existing row
    UPDATE public.rate_limits
    SET count = public.rate_limits.count + p_increment
    WHERE key = p_key AND window_start = p_window_start
    RETURNING count INTO new_count;

    IF FOUND THEN
      RETURN new_count;
    END IF;

    -- Row doesn't exist, try to insert
    BEGIN
      INSERT INTO public.rate_limits (key, window_start, count)
      VALUES (p_key, p_window_start, p_increment);
      RETURN p_increment;
    EXCEPTION WHEN unique_violation THEN
      -- If a concurrent insert happened, loop and try update again
    END;
  END LOOP;
END;
$$;

-- Add sub_role column to user_roles for additional role metadata
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS sub_role TEXT;

-- Create index for faster rate limit lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_window ON public.rate_limits (key, window_start);

-- Cleanup function to remove old rate limit entries (older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '24 hours';
END;
$$;