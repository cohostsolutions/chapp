-- Add role-specific notification settings and org-type preferences
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS role_type text DEFAULT 'agent',
  ADD COLUMN IF NOT EXISTS notify_lead_assignment boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_lead_status_change boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_new_messages boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_training_reminders boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_new_business boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_agent_performance boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_system_health boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_daily_summary boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_cross_org_alerts boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_new_organization boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_security_alerts boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_start time DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_end time DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS digest_frequency text DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS priority_hot_leads boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS priority_agent_takeover boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS priority_urgent_business boolean DEFAULT true;

-- Add RLS policies for notification_history to allow insert by service/system
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notification_history;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notification_history;
DROP POLICY IF EXISTS "Service can insert notifications" ON public.notification_history;

CREATE POLICY "Users can insert own notifications"
ON public.notification_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
ON public.notification_history
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notification_history
FOR UPDATE
USING (auth.uid() = user_id);

-- Create function to get notification settings for a user
CREATE OR REPLACE FUNCTION public.get_notification_settings(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role app_role;
  v_org_type ai_agent_type;
  v_settings jsonb;
BEGIN
  -- Get user's effective role
  v_role := get_effective_role(_user_id);
  
  -- Get organization type
  SELECT o.ai_agent_type INTO v_org_type
  FROM profiles p
  JOIN organizations o ON o.id = p.organization_id
  WHERE p.id = _user_id;
  
  -- Get notification preferences
  SELECT jsonb_build_object(
    'role', v_role,
    'org_type', COALESCE(v_org_type, 'jay'),
    'preferences', row_to_json(np.*)::jsonb
  ) INTO v_settings
  FROM notification_preferences np
  WHERE np.user_id = _user_id;
  
  RETURN COALESCE(v_settings, jsonb_build_object(
    'role', v_role,
    'org_type', COALESCE(v_org_type, 'jay'),
    'preferences', null
  ));
END;
$$;

-- Create trigger function to insert role-aware notifications
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_title text,
  p_message text DEFAULT NULL,
  p_type text DEFAULT 'info',
  p_channel text DEFAULT NULL,
  p_related_id text DEFAULT NULL,
  p_org_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  INSERT INTO notification_history (
    user_id,
    organization_id,
    title,
    message,
    type,
    channel,
    related_id,
    is_read
  ) VALUES (
    p_user_id,
    p_org_id,
    p_title,
    p_message,
    p_type,
    p_channel,
    p_related_id,
    false
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;