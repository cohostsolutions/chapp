-- Drop the ai_messages table as all messages are now consolidated in communications
-- First drop policies
DROP POLICY IF EXISTS "Super admins manage all ai_messages" ON public.ai_messages;
DROP POLICY IF EXISTS "Org users view ai_messages" ON public.ai_messages;
DROP POLICY IF EXISTS "Users view authorized ai_messages" ON public.ai_messages;
DROP POLICY IF EXISTS "Super admins manage org ai_messages" ON public.ai_messages;
DROP POLICY IF EXISTS "Impersonating client admin manage ai_messages" ON public.ai_messages;
DROP POLICY IF EXISTS "Impersonating agent view ai_messages" ON public.ai_messages;

-- Drop indexes
DROP INDEX IF EXISTS idx_ai_messages_external_id_unique;
DROP INDEX IF EXISTS idx_ai_messages_conversation_created;
DROP INDEX IF EXISTS idx_ai_messages_role;

-- Drop the table
DROP TABLE IF EXISTS public.ai_messages;