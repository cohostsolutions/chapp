-- Merge duplicate ai_conversations: keep oldest, delete newer duplicates
-- Step 1: Identify duplicates by lead_id and platform, keeping the oldest one
WITH duplicates AS (
  SELECT id, lead_id, platform,
    ROW_NUMBER() OVER (PARTITION BY lead_id, platform ORDER BY created_at ASC) as rn
  FROM ai_conversations
),
to_delete AS (
  SELECT id FROM duplicates WHERE rn > 1
)
DELETE FROM ai_conversations 
WHERE id IN (SELECT id FROM to_delete);

-- Step 2: Add a unique constraint on lead_id + platform to prevent future duplicates
-- Using COALESCE to handle potential null values safely
CREATE UNIQUE INDEX IF NOT EXISTS ai_conversations_lead_platform_unique 
ON ai_conversations (lead_id, platform) 
WHERE lead_id IS NOT NULL;