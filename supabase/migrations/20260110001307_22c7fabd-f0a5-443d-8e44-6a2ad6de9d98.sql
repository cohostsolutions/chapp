-- ============================================
-- INTERNAL ALERTING SYSTEM
-- ============================================

-- Alert rules configuration
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL UNIQUE,
  description TEXT,
  condition_type TEXT NOT NULL,
  threshold NUMERIC NOT NULL,
  comparison_operator TEXT NOT NULL DEFAULT '>',
  window_minutes INTEGER DEFAULT 5,
  notification_channels TEXT[] DEFAULT ARRAY['email'],
  notification_emails TEXT[],
  webhook_url TEXT,
  enabled BOOLEAN DEFAULT true,
  cooldown_minutes INTEGER DEFAULT 30,
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
  severity TEXT DEFAULT 'warning',
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ
);

-- Email queue table
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_addresses TEXT[] NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Function to check alert conditions
CREATE OR REPLACE FUNCTION check_alert_thresholds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rule RECORD;
  metric_value NUMERIC;
  should_alert BOOLEAN;
  alert_message TEXT;
  recent_alert TIMESTAMPTZ;
BEGIN
  FOR rule IN 
    SELECT * FROM alert_rules WHERE enabled = true
  LOOP
    SELECT MAX(triggered_at) INTO recent_alert
    FROM alert_notifications
    WHERE rule_id = rule.id
      AND resolved_at IS NULL
      AND triggered_at > now() - (rule.cooldown_minutes || ' minutes')::interval;
    
    IF recent_alert IS NOT NULL THEN
      CONTINUE;
    END IF;

    CASE rule.condition_type
      WHEN 'error_rate' THEN
        SELECT COUNT(*) INTO metric_value
        FROM audit_logs
        WHERE action = 'error'
          AND created_at > now() - (rule.window_minutes || ' minutes')::interval;
        alert_message := 'Error rate exceeded: ' || metric_value || ' errors in ' || rule.window_minutes || ' minutes';
      
      WHEN 'response_time' THEN
        SELECT COALESCE(AVG((metadata->>'duration')::numeric), 0) INTO metric_value
        FROM audit_logs
        WHERE action = 'query_executed'
          AND created_at > now() - (rule.window_minutes || ' minutes')::interval
          AND metadata->>'duration' IS NOT NULL;
        alert_message := 'Average response time: ' || ROUND(metric_value, 2) || 'ms';
      
      WHEN 'query_count' THEN
        SELECT COUNT(*) INTO metric_value
        FROM audit_logs
        WHERE action LIKE 'query%'
          AND created_at > now() - (rule.window_minutes || ' minutes')::interval;
        alert_message := 'Query count: ' || metric_value || ' in ' || rule.window_minutes || ' minutes';
      
      WHEN 'vault_failures' THEN
        SELECT COUNT(*) INTO metric_value
        FROM audit_logs
        WHERE action = 'vault_decrypt_failed'
          AND created_at > now() - (rule.window_minutes || ' minutes')::interval;
        alert_message := 'Vault decryption failures: ' || metric_value;
      
      WHEN 'lock_failures' THEN
        SELECT COUNT(*) INTO metric_value
        FROM audit_logs
        WHERE action = 'lock_claim_failed'
          AND created_at > now() - (rule.window_minutes || ' minutes')::interval;
        alert_message := 'Lock claim failures: ' || metric_value;
      
      ELSE
        CONTINUE;
    END CASE;

    should_alert := CASE rule.comparison_operator
      WHEN '>' THEN metric_value > rule.threshold
      WHEN '<' THEN metric_value < rule.threshold
      WHEN '>=' THEN metric_value >= rule.threshold
      WHEN '<=' THEN metric_value <= rule.threshold
      WHEN '=' THEN metric_value = rule.threshold
      ELSE false
    END;

    IF should_alert THEN
      INSERT INTO alert_notifications (rule_id, severity, message, details)
      VALUES (
        rule.id,
        CASE 
          WHEN metric_value > rule.threshold * 2 THEN 'critical'
          WHEN metric_value > rule.threshold * 1.5 THEN 'error'
          ELSE 'warning'
        END,
        alert_message,
        jsonb_build_object('rule_name', rule.rule_name, 'metric_value', metric_value, 'threshold', rule.threshold)
      );
    END IF;
  END LOOP;
END;
$$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_alert_notifications_triggered ON alert_notifications(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_rule ON alert_notifications(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_unsent ON alert_notifications(notification_sent) WHERE notification_sent = false;
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, created_at);

-- Enable RLS
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies

DROP POLICY IF EXISTS "Super admins can view alert notifications" ON alert_notifications;

CREATE POLICY "Super admins can view alert notifications"
  ON alert_notifications FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'super_admin'));

CREATE POLICY "Super admins can manage email queue"
  ON email_queue FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'super_admin'));

-- Insert default alert rules
INSERT INTO alert_rules (rule_name, description, condition_type, threshold, window_minutes) VALUES
  ('high_error_rate', 'Alert when error rate exceeds 10 errors in 5 minutes', 'error_rate', 10, 5),
  ('slow_response_time', 'Alert when average response time exceeds 3000ms', 'response_time', 3000, 5),
  ('vault_failures', 'Alert on vault decryption failures', 'vault_failures', 3, 5),
  ('lock_failures', 'Alert on processing lock failures', 'lock_failures', 5, 5)
ON CONFLICT (rule_name) DO NOTHING;