-- Migration: Remove Jay and May from ai_agent_type enum
-- Purpose: Enforce Cece as the only AI agent type across the system
-- Date: 2026-06-05

-- First, ensure all existing 'jay' and 'may' organizations are converted to 'cece'
UPDATE organizations 
SET ai_agent_type = 'cece'
WHERE ai_agent_type IN ('jay', 'may');

-- Recreate the enum type with only 'cece' value
-- Note: In PostgreSQL, we cannot directly remove enum values, so we must:
-- 1. Rename the old enum
-- 2. Create a new enum with correct values
-- 3. Update columns to use the new enum
-- 4. Drop the old enum

-- Create a new enum with only 'cece'
CREATE TYPE ai_agent_type_new AS ENUM ('cece');

-- Update the organizations table to use the new enum
ALTER TABLE organizations 
  ALTER COLUMN ai_agent_type DROP DEFAULT,
  ALTER COLUMN ai_agent_type TYPE ai_agent_type_new USING ai_agent_type::text::ai_agent_type_new,
  ALTER COLUMN ai_agent_type SET DEFAULT 'cece'::ai_agent_type_new;

-- Drop the old enum type
DROP TYPE IF EXISTS ai_agent_type CASCADE;

-- Rename the new enum to the original name
ALTER TYPE ai_agent_type_new RENAME TO ai_agent_type;

-- Verify the change
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'organizations' AND column_name = 'ai_agent_type';
