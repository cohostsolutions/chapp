-- Drop and recreate the trigger function to insert a system instruction instead of the raw guideline
CREATE OR REPLACE FUNCTION public.handle_checkout_auto_handback()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_type text;
  v_lead_id uuid;
  v_nights_stayed integer;
  v_follow_up_guideline text;
  v_conversation_id uuid;
  v_lead_name text;
BEGIN
  -- Only trigger when status changes to checked_out
  IF NEW.status = 'checked_out' AND (OLD.status IS NULL OR OLD.status != 'checked_out') THEN
    -- Check if this is a Cece organization
    SELECT ai_agent_type INTO v_org_type
    FROM public.organizations
    WHERE id = NEW.organization_id;
    
    IF v_org_type = 'cece' THEN
      v_lead_id := NEW.lead_id;
      v_nights_stayed := GREATEST(1, (NEW.check_out::date - NEW.check_in::date));
      
      -- Get lead name for context
      SELECT name INTO v_lead_name FROM public.leads WHERE id = v_lead_id;
      
      -- Update lead stay statistics
      UPDATE public.leads
      SET
        total_nights_stayed = COALESCE(total_nights_stayed, 0) + v_nights_stayed,
        total_bookings_count = COALESCE(total_bookings_count, 0) + 1,
        first_stay_date = COALESCE(first_stay_date, NEW.check_in::date),
        last_stay_date = NEW.check_out::date,
        is_ai_managed = true,
        assigned_agent_id = null,
        updated_at = now()
      WHERE id = v_lead_id;
      
      -- Get the after-sales follow-up guideline from organization config
      SELECT sales_process_config->'after_sales'->>'follow_up' INTO v_follow_up_guideline
      FROM public.organizations
      WHERE id = NEW.organization_id;
      
      -- Find the most recent active conversation for this lead
      SELECT id INTO v_conversation_id
      FROM public.ai_conversations
      WHERE lead_id = v_lead_id
        AND organization_id = NEW.organization_id
        AND status = 'active'
      ORDER BY updated_at DESC
      LIMIT 1;
      
      -- Insert a system instruction for Cece (not visible to guest, guides AI behavior)
      IF v_conversation_id IS NOT NULL AND v_follow_up_guideline IS NOT NULL THEN
        INSERT INTO public.ai_messages (conversation_id, role, content)
        VALUES (
          v_conversation_id, 
          'system', 
          '[SYSTEM] Guest ' || COALESCE(v_lead_name, 'Unknown') || ' has just checked out. ' ||
          'This conversation is now handed back to you for after-sales follow-up. ' ||
          'Follow this guideline to compose your follow-up message: ' || v_follow_up_guideline
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;