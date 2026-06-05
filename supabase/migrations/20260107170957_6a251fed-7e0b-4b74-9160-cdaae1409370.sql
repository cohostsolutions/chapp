-- Step 1: Delete duplicate ai_conversations FIRST (before merging leads)
-- Keep only the oldest conversation per lead+platform
WITH duplicates AS (
  SELECT id, lead_id, platform,
    ROW_NUMBER() OVER (PARTITION BY lead_id, platform ORDER BY created_at ASC) as rn
  FROM ai_conversations
  WHERE lead_id IS NOT NULL
),
to_delete AS (
  SELECT id FROM duplicates WHERE rn > 1
)
DELETE FROM ai_conversations 
WHERE id IN (SELECT id FROM to_delete);

-- Step 2: Now merge duplicate leads within the same org+phone
DO $$
DECLARE
  dup RECORD;
  kept_lead_id UUID;
  dupe_lead_id UUID;
BEGIN
  FOR dup IN
    SELECT organization_id, phone, 
           array_agg(id ORDER BY created_at ASC) as lead_ids
    FROM leads
    WHERE phone IS NOT NULL AND phone != ''
    GROUP BY organization_id, phone
    HAVING COUNT(*) > 1
  LOOP
    kept_lead_id := dup.lead_ids[1];
    
    FOR i IN 2..array_length(dup.lead_ids, 1) LOOP
      dupe_lead_id := dup.lead_ids[i];
      
      -- Move communications to kept lead
      UPDATE communications SET lead_id = kept_lead_id WHERE lead_id = dupe_lead_id;
      
      -- Delete duplicate ai_conversations for dupe lead (they'll conflict with kept lead's conversation)
      DELETE FROM ai_conversations WHERE lead_id = dupe_lead_id;
      
      -- Move other related records
      UPDATE bookings SET lead_id = kept_lead_id WHERE lead_id = dupe_lead_id;
      UPDATE orders SET lead_id = kept_lead_id WHERE lead_id = dupe_lead_id;
      UPDATE chat_messages SET lead_id = kept_lead_id WHERE lead_id = dupe_lead_id;
      UPDATE call_logs SET lead_id = kept_lead_id WHERE lead_id = dupe_lead_id;
      UPDATE calendar_events SET related_lead_id = kept_lead_id WHERE related_lead_id = dupe_lead_id;
      
      -- Delete the duplicate lead
      DELETE FROM leads WHERE id = dupe_lead_id;
    END LOOP;
  END LOOP;
END $$;

-- Step 3: Add unique constraint on leads (org + phone) to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS leads_org_phone_unique 
ON leads (organization_id, phone) 
WHERE phone IS NOT NULL AND phone != '';