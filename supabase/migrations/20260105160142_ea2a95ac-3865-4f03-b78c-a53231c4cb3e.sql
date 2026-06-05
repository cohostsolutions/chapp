CREATE OR REPLACE FUNCTION public.auto_checkout_from_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  checkout_keywords TEXT[] := ARRAY[
    'checking out',
    'check out',
    'checkout',
    'leaving now',
    'just left',
    'checked out',
    'departing',
    'left the room',
    'vacating',
    'i am leaving',
    'im leaving',
    'i''m leaving'
  ];
  lead_record RECORD;
  message_lower TEXT;
BEGIN
  -- Only process user messages (not AI responses)
  IF NEW.role != 'user' THEN
    RETURN NEW;
  END IF;

  message_lower := lower(NEW.content);

  -- Check if message contains any checkout keywords
  IF NOT EXISTS (
    SELECT 1 FROM unnest(checkout_keywords) keyword
    WHERE message_lower LIKE '%' || keyword || '%'
  ) THEN
    RETURN NEW;
  END IF;

  -- Get the conversation and associated lead
  SELECT ac.lead_id, ac.organization_id INTO lead_record
  FROM ai_conversations ac
  WHERE ac.id = NEW.conversation_id;

  IF lead_record.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find active bookings for this lead (checked_in status)
  UPDATE bookings
  SET status = 'checked_out', updated_at = now()
  WHERE lead_id = lead_record.lead_id
    AND organization_id = lead_record.organization_id
    AND status = 'checked_in'
    AND check_out >= CURRENT_DATE;

  -- Log this auto-checkout if any rows were updated
  IF FOUND THEN
    INSERT INTO audit_logs (action, resource_type, resource_id, details)
    VALUES (
      'auto_checkout',
      'booking',
      lead_record.lead_id,
      jsonb_build_object(
        'trigger', 'chat_message',
        'message_preview', substring(NEW.content, 1, 100),
        'conversation_id', NEW.conversation_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;