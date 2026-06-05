-- Advanced notification customization schema

-- Add per-notification delivery preferences (JSONB for flexibility)
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS delivery_preferences jsonb DEFAULT '{
    "lead_assignment": {"browser": true, "email": false, "sound": true, "priority": "high"},
    "lead_status_change": {"browser": true, "email": false, "sound": false, "priority": "medium"},
    "new_message": {"browser": true, "email": false, "sound": true, "priority": "high"},
    "training_reminder": {"browser": true, "email": true, "sound": false, "priority": "low"},
    "new_business": {"browser": true, "email": false, "sound": true, "priority": "high"},
    "agent_takeover": {"browser": true, "email": true, "sound": true, "priority": "critical"},
    "agent_handback": {"browser": true, "email": false, "sound": false, "priority": "medium"},
    "agent_performance": {"browser": true, "email": true, "sound": false, "priority": "medium"},
    "daily_summary": {"browser": false, "email": true, "sound": false, "priority": "low"},
    "cross_org_alert": {"browser": true, "email": true, "sound": true, "priority": "critical"},
    "new_organization": {"browser": true, "email": false, "sound": false, "priority": "medium"},
    "security_alert": {"browser": true, "email": true, "sound": true, "priority": "critical"},
    "system_health": {"browser": true, "email": true, "sound": true, "priority": "high"}
  }'::jsonb,
  -- Notification grouping/batching
  ADD COLUMN IF NOT EXISTS grouping_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS grouping_interval_minutes integer DEFAULT 5,
  -- Custom notification sounds
  ADD COLUMN IF NOT EXISTS custom_sounds jsonb DEFAULT '{
    "critical": "urgent",
    "high": "default",
    "medium": "soft",
    "low": "silent"
  }'::jsonb,
  -- Device preferences
  ADD COLUMN IF NOT EXISTS desktop_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS mobile_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS mobile_push_enabled boolean DEFAULT true,
  -- Snooze functionality
  ADD COLUMN IF NOT EXISTS is_snoozed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS snooze_until timestamp with time zone DEFAULT NULL,
  -- Multiple quiet hour windows (array of objects)
  ADD COLUMN IF NOT EXISTS quiet_windows jsonb DEFAULT '[]'::jsonb,
  -- Value-based alerts
  ADD COLUMN IF NOT EXISTS value_alerts_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_order_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_booking_value numeric DEFAULT 0,
  -- Custom priority levels
  ADD COLUMN IF NOT EXISTS custom_priorities jsonb DEFAULT '{
    "critical": {"bypass_quiet": true, "force_sound": true, "repeat_interval": 0},
    "high": {"bypass_quiet": true, "force_sound": false, "repeat_interval": 0},
    "medium": {"bypass_quiet": false, "force_sound": false, "repeat_interval": 0},
    "low": {"bypass_quiet": false, "force_sound": false, "repeat_interval": 0}
  }'::jsonb;

-- Create function to check if user is currently snoozed
CREATE OR REPLACE FUNCTION public.is_notifications_snoozed(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_snoozed AND (snooze_until IS NULL OR snooze_until > now())
     FROM notification_preferences
     WHERE user_id = _user_id),
    false
  )
$$;