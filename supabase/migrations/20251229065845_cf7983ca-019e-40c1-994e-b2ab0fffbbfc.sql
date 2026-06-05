-- Add custom_lead_statuses and agent_takeover_criteria to organizations table
-- Custom statuses: toggleable defaults + custom ones
-- Takeover criteria: flexible prompt-based configuration

ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS custom_lead_statuses jsonb DEFAULT '{
  "default_statuses": {
    "new": {"enabled": true, "color": "primary", "order": 1},
    "contacted": {"enabled": true, "color": "warning", "order": 2},
    "qualified": {"enabled": true, "color": "success", "order": 3},
    "converted": {"enabled": true, "color": "success", "order": 4},
    "lost": {"enabled": true, "color": "destructive", "order": 5}
  },
  "custom_statuses": []
}'::jsonb;

ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS agent_takeover_criteria jsonb DEFAULT '{
  "enabled": false,
  "criteria_prompt": "",
  "examples": [
    "Customer explicitly requests to speak with a human agent",
    "Customer expresses frustration or dissatisfaction repeatedly",
    "Conversation exceeds 10 messages without resolution",
    "Customer mentions legal action or formal complaint",
    "Technical issues the AI cannot resolve"
  ],
  "auto_notify_agent": true
}'::jsonb;