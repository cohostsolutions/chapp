-- Drop the RESTRICTIVE authentication-only policy that's causing the security concern
-- The "Users view authorized profiles" policy already handles proper access control
DROP POLICY IF EXISTS "Require authentication for profiles" ON public.profiles;