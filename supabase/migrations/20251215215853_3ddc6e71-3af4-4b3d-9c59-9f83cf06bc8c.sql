-- Fix 3: social_platforms_safe is a VIEW, not a table
-- Views cannot have RLS policies directly - they inherit from underlying tables
-- The underlying social_platforms table already has proper RLS
-- Disable RLS on the view to allow proper access through the base table's security
ALTER VIEW public.social_platforms_safe SET (security_invoker = true);