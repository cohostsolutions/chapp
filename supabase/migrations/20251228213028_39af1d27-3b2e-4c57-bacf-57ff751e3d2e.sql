-- Update migration_logs to track all asset types
ALTER TABLE migration_logs 
ADD COLUMN IF NOT EXISTS migrated_bookings jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS migrated_orders jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS migrated_offerings jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS migrated_room_units jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS migrated_knowledge_entries jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS migrated_knowledge_docs jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS migrated_reports jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS migrated_workflows jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS migrated_calendar_events jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS migrated_communications jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS migrated_message_templates jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS migrated_training_modules jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS migrated_team_chats jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS migrated_ai_conversations jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS migrated_agent_priorities jsonb NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS migrated_rubric_templates jsonb NOT NULL DEFAULT '[]';