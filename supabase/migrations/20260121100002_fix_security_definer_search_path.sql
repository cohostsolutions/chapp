-- ============================================
-- Security Fix: Add search_path to SECURITY DEFINER Functions
-- ============================================
-- Date: January 21, 2026
-- Issue: Multiple SECURITY DEFINER functions missing explicit search_path
-- Risk: Privilege escalation via schema shadowing attacks
-- 
-- This migration adds SET search_path to all vulnerable functions

-- ============================================
-- FIX #1: check_alert_thresholds()
-- ============================================
-- File: 20260109000000_alert_system.sql
-- Vulnerability: SECURITY DEFINER without search_path

CREATE OR REPLACE FUNCTION check_alert_thresholds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  rule RECORD;
  metric_value NUMERIC;
  should_alert BOOLEAN;
  existing_alert UUID;
BEGIN
  FOR rule IN SELECT * FROM alert_rules WHERE is_active = true
  LOOP
    should_alert := FALSE;
    metric_value := 0;

    -- Calculate metric based on type
    IF rule.metric_type = 'lead_conversion_rate' THEN
      SELECT 
        COALESCE(
          (COUNT(*) FILTER (WHERE status = 'converted')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
          0
        ) INTO metric_value
      FROM leads
      WHERE organization_id = rule.organization_id
        AND created_at >= NOW() - rule.time_window;

    ELSIF rule.metric_type = 'response_time' THEN
      SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60), 0)
      INTO metric_value
      FROM leads
      WHERE organization_id = rule.organization_id
        AND status = 'contacted'
        AND created_at >= NOW() - rule.time_window;

    ELSIF rule.metric_type = 'unassigned_leads' THEN
      SELECT COUNT(*) INTO metric_value
      FROM leads
      WHERE organization_id = rule.organization_id
        AND assigned_agent_id IS NULL
        AND created_at >= NOW() - rule.time_window;
    END IF;

    -- Check if alert should be triggered
    IF (rule.comparison_operator = 'greater_than' AND metric_value > rule.threshold_value) OR
       (rule.comparison_operator = 'less_than' AND metric_value < rule.threshold_value) OR
       (rule.comparison_operator = 'equals' AND metric_value = rule.threshold_value) THEN
      should_alert := TRUE;
    END IF;

    IF should_alert THEN
      -- Check for existing unresolved alert
      SELECT id INTO existing_alert
      FROM alert_notifications
      WHERE rule_id = rule.id
        AND resolved_at IS NULL
      LIMIT 1;

      -- Create new alert if none exists
      IF existing_alert IS NULL THEN
        INSERT INTO alert_notifications (
          rule_id,
          triggered_at,
          metric_value,
          message
        ) VALUES (
          rule.id,
          NOW(),
          metric_value,
          rule.alert_message || ' (Current value: ' || metric_value || ')'
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- ============================================
-- FIX #2: send_alert_notifications()
-- ============================================
-- File: 20260109000000_alert_system.sql
-- Vulnerability: SECURITY DEFINER without search_path

CREATE OR REPLACE FUNCTION send_alert_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  alert RECORD;
  recipient TEXT;
BEGIN
  FOR alert IN
    SELECT 
      an.id,
      an.message,
      an.severity,
      an.triggered_at,
      ar.organization_id,
      ar.notification_channels
    FROM alert_notifications an
    JOIN alert_rules ar ON ar.id = an.rule_id
    WHERE an.notification_sent = FALSE
      AND an.resolved_at IS NULL
  LOOP
    -- Get organization admin emails
    FOR recipient IN
      SELECT p.email
      FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id
      WHERE p.organization_id = alert.organization_id
        AND ur.role IN ('super_admin', 'client_admin')
    LOOP
      -- Queue email notification
      INSERT INTO email_queue (
        to_addresses,
        subject,
        body_text,
        priority
      ) VALUES (
        ARRAY[recipient],
        'Alert: ' || alert.message,
        alert.message || E'\n\nTriggered at: ' || alert.triggered_at::text,
        'high'
      );
    END LOOP;

    -- Mark as sent
    UPDATE alert_notifications
    SET notification_sent = true,
        notification_sent_at = now()
    WHERE id = alert.id;
  END LOOP;
END;
$$;

-- ============================================
-- FIX #3: auto_checkout_from_chat()
-- ============================================
-- File: 20260105021817_89c8aa74-90e9-4417-824c-e5637b1ca133.sql
-- Vulnerability: SECURITY DEFINER without search_path

CREATE OR REPLACE FUNCTION public.auto_checkout_from_chat()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  checkout_keywords TEXT[] := ARRAY['checking out', 'check out', 'checkout', 'leaving', 'departing', 'departure'];
  kw TEXT;
  _booking RECORD;
  _lead_id UUID;
BEGIN
  -- Only process messages from users (not system/assistant)
  IF NEW.sender_type IS DISTINCT FROM 'user' THEN
    RETURN NEW;
  END IF;

  -- Check if message contains checkout keyword
  FOR kw IN SELECT unnest(checkout_keywords)
  LOOP
    IF NEW.message_text ILIKE '%' || kw || '%' THEN
      -- Find active booking for this conversation
      SELECT b.id, b.guest_name, b.check_out_date, b.lead_id
      INTO _booking
      FROM bookings b
      JOIN ai_conversations c ON c.lead_id = b.lead_id
      WHERE c.id = NEW.conversation_id
        AND b.status = 'checked_in'
      LIMIT 1;

      IF _booking.id IS NOT NULL THEN
        -- Update booking to checked_out
        UPDATE bookings
        SET status = 'checked_out',
            updated_at = now()
        WHERE id = _booking.id;

        -- Insert system message
        INSERT INTO ai_conversation_messages (
          conversation_id,
          role,
          content,
          sender_type
        ) VALUES (
          NEW.conversation_id,
          'assistant',
          'Thank you for staying with us, ' || _booking.guest_name || '! Your checkout has been processed. We hope to see you again soon!',
          'system'
        );

        -- Update lead status if needed
        SELECT lead_id INTO _lead_id FROM ai_conversations WHERE id = NEW.conversation_id;
        IF _lead_id IS NOT NULL THEN
          UPDATE leads
          SET status = 'completed',
              updated_at = now()
          WHERE id = _lead_id;
        END IF;
      END IF;

      EXIT; -- Stop after first keyword match
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ============================================
-- FIX #4: run_booking_status_updates()
-- ============================================
-- File: 20260105021817_89c8aa74-90e9-4417-824c-e5637b1ca133.sql
-- Vulnerability: SECURITY DEFINER without search_path

CREATE OR REPLACE FUNCTION public.run_booking_status_updates()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  today DATE := CURRENT_DATE;
BEGIN
  -- Auto check-in: confirmed bookings where check_in date has passed
  UPDATE bookings
  SET status = 'checked_in',
      updated_at = now()
  WHERE status = 'confirmed'
    AND check_in_date <= today;

  -- Auto check-out: checked_in bookings where check_out date has passed
  UPDATE bookings
  SET status = 'checked_out',
      updated_at = now()
  WHERE status = 'checked_in'
    AND check_out_date < today;
END;
$$;

-- ============================================
-- FIX #5: training_stats()
-- ============================================
-- File: 20241226120000_training.sql
-- Vulnerability: SECURITY DEFINER without search_path (lowercase syntax)

CREATE OR REPLACE FUNCTION public.training_stats(
  p_org_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  result JSONB;
  total_sessions INT;
  avg_score NUMERIC;
  completion_rate NUMERIC;
BEGIN
  -- Count total sessions
  SELECT COUNT(*)
  INTO total_sessions
  FROM training_sessions
  WHERE organization_id = p_org_id
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date)
    AND (p_user_id IS NULL OR user_id = p_user_id);

  -- Calculate average score
  SELECT AVG(score)
  INTO avg_score
  FROM training_sessions
  WHERE organization_id = p_org_id
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date)
    AND (p_user_id IS NULL OR user_id = p_user_id)
    AND score IS NOT NULL;

  -- Calculate completion rate
  SELECT 
    CASE 
      WHEN COUNT(*) = 0 THEN 0
      ELSE (COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::NUMERIC / COUNT(*)) * 100
    END
  INTO completion_rate
  FROM training_sessions
  WHERE organization_id = p_org_id
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date)
    AND (p_user_id IS NULL OR user_id = p_user_id);

  -- Build result JSON
  result := jsonb_build_object(
    'total_sessions', total_sessions,
    'average_score', COALESCE(avg_score, 0),
    'completion_rate', COALESCE(completion_rate, 0)
  );

  RETURN result;
END;
$$;

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
DECLARE
  func_count INTEGER;
BEGIN
  -- Count remaining vulnerable functions
  SELECT COUNT(*)
  INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND prosecdef = true  -- SECURITY DEFINER
    AND NOT EXISTS (
      SELECT 1 FROM unnest(proconfig) cfg 
      WHERE cfg LIKE 'search_path=%'
    );
  
  IF func_count = 0 THEN
    RAISE NOTICE '✅ SUCCESS: All SECURITY DEFINER functions now have explicit search_path';
  ELSE
    RAISE WARNING '⚠️  Still found % SECURITY DEFINER functions without search_path', func_count;
  END IF;
END $$;
