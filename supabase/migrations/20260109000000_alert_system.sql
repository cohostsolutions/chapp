-- ============================================
-- INTERNAL ALERTING SYSTEM
-- ============================================
-- Self-hosted alerting using database triggers
-- No external services required (PagerDuty, etc.)

-- Alert rules configuration
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL UNIQUE,
  description TEXT,
  condition_type TEXT NOT NULL, -- 'error_rate', 'response_time', 'query_count', 'custom'
  threshold NUMERIC NOT NULL,
  comparison_operator TEXT NOT NULL DEFAULT '>', -- '>', '<', '>=', '<=', '='
  window_minutes INTEGER DEFAULT 5,
  notification_channels TEXT[] DEFAULT ARRAY['email'], -- 'email', 'database', 'webhook'
  notification_emails TEXT[],
  webhook_url TEXT,
  enabled BOOLEAN DEFAULT true,
  cooldown_minutes INTEGER DEFAULT 30, -- Prevent alert spam
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Alert notifications log
CREATE TABLE IF NOT EXISTS alert_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  severity TEXT DEFAULT 'warning', -- 'info', 'warning', 'error', 'critical'
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ
);

-- Function to check alert conditions
CREATE OR REPLACE FUNCTION check_alert_thresholds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rule RECORD;
  metric_value NUMERIC;
  should_alert BOOLEAN;
  alert_message TEXT;
  recent_alert TIMESTAMPTZ;
BEGIN
  -- Loop through all enabled alert rules
  FOR rule IN 
    SELECT * FROM alert_rules WHERE enabled = true
  LOOP
    -- Check if rule is in cooldown period
    SELECT MAX(triggered_at) INTO recent_alert
    FROM alert_notifications
    WHERE rule_id = rule.id
      AND resolved_at IS NULL
      AND triggered_at > now() - (rule.cooldown_minutes || ' minutes')::interval;
    
    IF recent_alert IS NOT NULL THEN
      CONTINUE; -- Skip this rule, still in cooldown
    END IF;

    -- Calculate metric based on condition type
    CASE rule.condition_type
      
      -- ERROR RATE: Count errors in time window
      WHEN 'error_rate' THEN
        SELECT COUNT(*) INTO metric_value
        FROM audit_logs
        WHERE action = 'error'
          AND created_at > now() - (rule.window_minutes || ' minutes')::interval;
        
        alert_message := 'Error rate exceeded: ' || metric_value || ' errors in ' || rule.window_minutes || ' minutes';
      
      -- RESPONSE TIME: Average query duration
      WHEN 'response_time' THEN
        SELECT AVG((metadata->>'duration')::numeric) INTO metric_value
        FROM audit_logs
        WHERE action = 'query_executed'
          AND created_at > now() - (rule.window_minutes || ' minutes')::interval
          AND metadata->>'duration' IS NOT NULL;
        
        alert_message := 'Average response time: ' || ROUND(metric_value, 2) || 'ms (threshold: ' || rule.threshold || 'ms)';
      
      -- QUERY COUNT: Total queries in window
      WHEN 'query_count' THEN
        SELECT COUNT(*) INTO metric_value
        FROM audit_logs
        WHERE action LIKE 'query%'
          AND created_at > now() - (rule.window_minutes || ' minutes')::interval;
        
        alert_message := 'Query count: ' || metric_value || ' in ' || rule.window_minutes || ' minutes';
      
      -- VAULT FAILURES: Decryption failures
      WHEN 'vault_failures' THEN
        SELECT COUNT(*) INTO metric_value
        FROM audit_logs
        WHERE action = 'vault_decrypt_failed'
          AND created_at > now() - (rule.window_minutes || ' minutes')::interval;
        
        alert_message := 'Vault decryption failures: ' || metric_value || ' in ' || rule.window_minutes || ' minutes';
      
      -- DATABASE LOCKS: Processing lock failures
      WHEN 'lock_failures' THEN
        SELECT COUNT(*) INTO metric_value
        FROM audit_logs
        WHERE action = 'lock_claim_failed'
          AND created_at > now() - (rule.window_minutes || ' minutes')::interval;
        
        alert_message := 'Lock claim failures: ' || metric_value || ' in ' || rule.window_minutes || ' minutes';
      
      ELSE
        CONTINUE; -- Unknown condition type
    END CASE;

    -- Check if threshold is exceeded
    should_alert := CASE rule.comparison_operator
      WHEN '>' THEN metric_value > rule.threshold
      WHEN '<' THEN metric_value < rule.threshold
      WHEN '>=' THEN metric_value >= rule.threshold
      WHEN '<=' THEN metric_value <= rule.threshold
      WHEN '=' THEN metric_value = rule.threshold
      ELSE false
    END;

    -- Create alert notification if threshold exceeded
    IF should_alert THEN
      INSERT INTO alert_notifications (
        rule_id,
        triggered_at,
        severity,
        message,
        details
      ) VALUES (
        rule.id,
        now(),
        CASE 
          WHEN metric_value > rule.threshold * 2 THEN 'critical'
          WHEN metric_value > rule.threshold * 1.5 THEN 'error'
          ELSE 'warning'
        END,
        alert_message,
        jsonb_build_object(
          'rule_name', rule.rule_name,
          'metric_value', metric_value,
          'threshold', rule.threshold,
          'window_minutes', rule.window_minutes
        )
      );

      -- Log to audit_logs for visibility
      INSERT INTO audit_logs (action, resource_type, metadata)
      VALUES (
        'alert_triggered',
        'alert_rule',
        jsonb_build_object(
          'rule_id', rule.id,
          'rule_name', rule.rule_name,
          'message', alert_message,
          'metric_value', metric_value,
          'threshold', rule.threshold
        )
      );
    END IF;
  END LOOP;
END;
$$;

-- Function to send alert notifications (called separately)
CREATE OR REPLACE FUNCTION send_alert_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  alert RECORD;
  rule RECORD;
BEGIN
  -- Find unsent notifications
  FOR alert IN 
    SELECT an.*, ar.notification_emails, ar.webhook_url, ar.notification_channels
    FROM alert_notifications an
    JOIN alert_rules ar ON an.rule_id = ar.id
    WHERE an.notification_sent = false
      AND an.triggered_at > now() - interval '1 hour' -- Only recent alerts
  LOOP
    -- Email notification (use Resend API via edge function)
    IF 'email' = ANY(alert.notification_channels) AND alert.notification_emails IS NOT NULL THEN
      -- Insert into email queue (processed by edge function)
      INSERT INTO email_queue (
        to_addresses,
        subject,
        body_text,
        priority
      ) VALUES (
        alert.notification_emails,
        '[ALERT] ' || (alert.details->>'rule_name')::text,
        alert.message || E'\n\nTriggered at: ' || alert.triggered_at::text,
        'high'
      );
    END IF;

    -- Mark as sent
    UPDATE alert_notifications
    SET notification_sent = true,
        notification_sent_at = now()
    WHERE id = alert.id;
  END LOOP;
END;
$$;

-- Email queue table (for async email sending)
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_addresses TEXT[] NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Insert default alert rules
INSERT INTO alert_rules (rule_name, description, condition_type, threshold, window_minutes, notification_emails) VALUES
  ('high_error_rate', 'Alert when error rate exceeds 10 errors in 5 minutes', 'error_rate', 10, 5, ARRAY['admin@yourdomain.com']),
  ('slow_response_time', 'Alert when average response time exceeds 3000ms', 'response_time', 3000, 5, ARRAY['admin@yourdomain.com']),
  ('vault_failures', 'Alert on vault decryption failures', 'vault_failures', 3, 5, ARRAY['admin@yourdomain.com']),
  ('lock_failures', 'Alert on processing lock failures', 'lock_failures', 5, 5, ARRAY['admin@yourdomain.com'])
ON CONFLICT (rule_name) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_alert_notifications_triggered ON alert_notifications(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_rule ON alert_notifications(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_unsent ON alert_notifications(notification_sent) WHERE notification_sent = false;
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, created_at);

-- RLS Policies (super_admin only)
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage alert rules"
  ON alert_rules FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'super_admin'));

CREATE POLICY "Super admins can view alert notifications"
  ON alert_notifications FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'super_admin'));

CREATE POLICY "System can manage email queue"
  ON email_queue FOR ALL
  USING (true); -- Service role only

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON alert_rules TO authenticated;
GRANT SELECT ON alert_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON email_queue TO service_role;

COMMENT ON TABLE alert_rules IS 'Configuration for internal alerting system';
COMMENT ON TABLE alert_notifications IS 'Log of triggered alerts';
COMMENT ON TABLE email_queue IS 'Queue for async email sending via edge function';
COMMENT ON FUNCTION check_alert_thresholds() IS 'Check all alert rules and create notifications if thresholds exceeded';
COMMENT ON FUNCTION send_alert_notifications() IS 'Send pending alert notifications via configured channels';
