-- Create table to track login attempts
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  attempted_at timestamp with time zone NOT NULL DEFAULT now(),
  was_successful boolean NOT NULL DEFAULT false
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON public.login_attempts (email, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON public.login_attempts (ip_address, attempted_at DESC) WHERE ip_address IS NOT NULL;

-- Enable RLS (only service role can access)
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- No policies = only service role can access (this is intentional for security)

-- Create function to check if account is locked
CREATE OR REPLACE FUNCTION public.check_account_lockout(
  p_email text,
  p_max_attempts integer DEFAULT 5,
  p_lockout_duration_minutes integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_failed_count integer;
  v_last_attempt timestamp with time zone;
  v_lockout_until timestamp with time zone;
  v_is_locked boolean;
BEGIN
  -- Count failed attempts in the lockout window
  SELECT 
    COUNT(*),
    MAX(attempted_at)
  INTO v_failed_count, v_last_attempt
  FROM public.login_attempts
  WHERE email = LOWER(p_email)
    AND was_successful = false
    AND attempted_at > (now() - (p_lockout_duration_minutes || ' minutes')::interval);
  
  -- Check if account is locked
  v_is_locked := v_failed_count >= p_max_attempts;
  
  IF v_is_locked AND v_last_attempt IS NOT NULL THEN
    v_lockout_until := v_last_attempt + (p_lockout_duration_minutes || ' minutes')::interval;
  END IF;
  
  RETURN jsonb_build_object(
    'is_locked', v_is_locked,
    'failed_attempts', v_failed_count,
    'max_attempts', p_max_attempts,
    'lockout_until', v_lockout_until,
    'remaining_attempts', GREATEST(0, p_max_attempts - v_failed_count)
  );
END;
$$;

-- Create function to record login attempt
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_email text,
  p_ip_address text DEFAULT NULL,
  p_was_successful boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert the attempt
  INSERT INTO public.login_attempts (email, ip_address, was_successful)
  VALUES (LOWER(p_email), p_ip_address, p_was_successful);
  
  -- If successful, clean up old failed attempts for this email (optional, keeps table clean)
  IF p_was_successful THEN
    DELETE FROM public.login_attempts
    WHERE email = LOWER(p_email)
      AND was_successful = false
      AND attempted_at < now() - interval '24 hours';
  END IF;
  
  -- Clean up old attempts (older than 24 hours) to prevent table bloat
  DELETE FROM public.login_attempts
  WHERE attempted_at < now() - interval '24 hours';
END;
$$;

-- Grant execute to anon and authenticated roles for the check function
GRANT EXECUTE ON FUNCTION public.check_account_lockout TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_attempt TO anon, authenticated;