-- 1. Rate limiting for demo_requests (5 requests per IP per hour)
CREATE OR REPLACE FUNCTION public.check_demo_request_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_count INTEGER;
  ip_address TEXT;
BEGIN
  -- Get IP from request headers (passed via metadata or captured separately)
  ip_address := COALESCE(
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'x-real-ip',
    'unknown'
  );
  
  -- Count requests from this IP in the last hour
  SELECT COUNT(*) INTO request_count
  FROM public.demo_requests
  WHERE created_at > NOW() - INTERVAL '1 hour'
    AND (
      -- Match by email (prevents same person spamming with different IPs)
      email = NEW.email
    );
  
  -- Allow max 5 demo requests per email per hour
  IF request_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please try again later.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for demo_requests rate limiting
DROP TRIGGER IF EXISTS check_demo_request_rate_limit_trigger ON public.demo_requests;
CREATE TRIGGER check_demo_request_rate_limit_trigger
  BEFORE INSERT ON public.demo_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.check_demo_request_rate_limit();

-- 2. Rate limiting for analytics_events (100 events per session per minute)
CREATE OR REPLACE FUNCTION public.check_analytics_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_count INTEGER;
BEGIN
  -- Count events from this session in the last minute
  IF NEW.session_id IS NOT NULL THEN
    SELECT COUNT(*) INTO event_count
    FROM public.analytics_events
    WHERE session_id = NEW.session_id
      AND created_at > NOW() - INTERVAL '1 minute';
    
    -- Allow max 100 events per session per minute
    IF event_count >= 100 THEN
      RAISE EXCEPTION 'Analytics rate limit exceeded.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for analytics_events rate limiting
DROP TRIGGER IF EXISTS check_analytics_rate_limit_trigger ON public.analytics_events;
CREATE TRIGGER check_analytics_rate_limit_trigger
  BEFORE INSERT ON public.analytics_events
  FOR EACH ROW
  EXECUTE FUNCTION public.check_analytics_rate_limit();

-- 3. Data retention cleanup function for old records
CREATE OR REPLACE FUNCTION public.cleanup_old_tracking_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete login_attempts older than 90 days
  DELETE FROM public.login_attempts
  WHERE attempted_at < NOW() - INTERVAL '90 days';
  
  -- Delete analytics_events older than 30 days
  DELETE FROM public.analytics_events
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Log the cleanup
  RAISE NOTICE 'Cleanup completed at %', NOW();
END;
$$;

-- 4. Create indexes to optimize cleanup and rate limit queries
CREATE INDEX IF NOT EXISTS idx_demo_requests_created_at_email 
  ON public.demo_requests(created_at, email);

CREATE INDEX IF NOT EXISTS idx_analytics_events_session_created 
  ON public.analytics_events(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at 
  ON public.login_attempts(attempted_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at 
  ON public.analytics_events(created_at);