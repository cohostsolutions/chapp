-- Fix: Ensure increment_rate_limit has immutable search_path
-- Change from "SET search_path = public" to explicitly replace the function
-- with a cleaner, more explicit search_path setting

-- Drop and recreate increment_rate_limit with proper fixed search_path
DROP FUNCTION IF EXISTS public.increment_rate_limit(text, timestamptz, int);

CREATE FUNCTION public.increment_rate_limit(
  p_key text,
  p_window_start timestamptz,
  p_increment int
)
RETURNS int 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
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

-- Fix: Ensure cleanup_old_rate_limits has immutable search_path
DROP FUNCTION IF EXISTS public.cleanup_old_rate_limits();

CREATE FUNCTION public.cleanup_old_rate_limits()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '24 hours';
END;
$$;

COMMENT ON FUNCTION public.increment_rate_limit(text, timestamptz, int) IS 'Atomically increments rate limit counter with fixed search_path to prevent privilege escalation';
COMMENT ON FUNCTION public.cleanup_old_rate_limits() IS 'Cleans up old rate limit entries with fixed search_path to prevent privilege escalation';
