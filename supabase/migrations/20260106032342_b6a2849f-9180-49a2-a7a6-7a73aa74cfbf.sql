-- Add stay tracking columns to leads table
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS total_nights_stayed integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_bookings_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS first_stay_date date,
ADD COLUMN IF NOT EXISTS last_stay_date date;

-- Create function to handle checkout auto-handback for Cece organizations
CREATE OR REPLACE FUNCTION public.handle_checkout_auto_handback()
RETURNS TRIGGER AS $$
DECLARE
  v_org_type text;
  v_lead_is_ai_managed boolean;
  v_lead_assigned_agent_id uuid;
  v_follow_up_message text;
  v_nights_stayed integer;
  v_conversation_id uuid;
  v_booking_check_in date;
  v_booking_check_out date;
BEGIN
  -- Only proceed if status changed to 'checked_out'
  IF NEW.status != 'checked_out' OR OLD.status = 'checked_out' THEN
    RETURN NEW;
  END IF;

  -- Get organization AI agent type and after_sales follow_up message
  SELECT 
    ai_agent_type::text,
    COALESCE((sales_process_config->'after_sales'->>'follow_up'), '')
  INTO v_org_type, v_follow_up_message
  FROM organizations
  WHERE id = NEW.organization_id;

  -- Only proceed for Cece organizations
  IF v_org_type != 'cece' THEN
    RETURN NEW;
  END IF;

  -- Get lead status
  SELECT is_ai_managed, assigned_agent_id
  INTO v_lead_is_ai_managed, v_lead_assigned_agent_id
  FROM leads
  WHERE id = NEW.lead_id;

  -- Calculate nights stayed for this booking
  v_booking_check_in := NEW.check_in::date;
  v_booking_check_out := NEW.check_out::date;
  v_nights_stayed := v_booking_check_out - v_booking_check_in;
  IF v_nights_stayed < 0 THEN
    v_nights_stayed := 0;
  END IF;

  -- Update lead stay statistics
  UPDATE leads
  SET 
    total_nights_stayed = COALESCE(total_nights_stayed, 0) + v_nights_stayed,
    total_bookings_count = COALESCE(total_bookings_count, 0) + 1,
    first_stay_date = COALESCE(first_stay_date, v_booking_check_in),
    last_stay_date = v_booking_check_out,
    updated_at = now()
  WHERE id = NEW.lead_id;

  -- If lead is already AI-managed, no handback needed
  IF v_lead_is_ai_managed = true AND v_lead_assigned_agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Hand back to AI: mark as AI-managed and clear agent assignment
  UPDATE leads
  SET 
    is_ai_managed = true,
    assigned_agent_id = null,
    updated_at = now()
  WHERE id = NEW.lead_id;

  -- Find the most recent active conversation for this lead
  SELECT id INTO v_conversation_id
  FROM ai_conversations
  WHERE lead_id = NEW.lead_id
    AND organization_id = NEW.organization_id
  ORDER BY updated_at DESC
  LIMIT 1;

  -- If there's a conversation and a follow-up message configured, insert the handback message
  IF v_conversation_id IS NOT NULL AND v_follow_up_message != '' THEN
    INSERT INTO ai_messages (conversation_id, role, content, metadata)
    VALUES (
      v_conversation_id,
      'system',
      'Guest checked out. Conversation returned to AI assistant.',
      jsonb_build_object(
        'type', 'auto_handback',
        'reason', 'checkout',
        'booking_id', NEW.id,
        'nights_stayed', v_nights_stayed
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for checkout auto-handback
DROP TRIGGER IF EXISTS trigger_checkout_auto_handback ON public.bookings;
CREATE TRIGGER trigger_checkout_auto_handback
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_checkout_auto_handback();