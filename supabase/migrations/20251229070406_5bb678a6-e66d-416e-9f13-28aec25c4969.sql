-- Add customizable takeover and handback messages to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS agent_takeover_message text DEFAULT 'I''ll connect you with someone from our team who can better assist you. They''ll be in touch shortly!',
ADD COLUMN IF NOT EXISTS ai_handback_message text DEFAULT '{agent_name} is back to assist you! Feel free to continue your conversation.';