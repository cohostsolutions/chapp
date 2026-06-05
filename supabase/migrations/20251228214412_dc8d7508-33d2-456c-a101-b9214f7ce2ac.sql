-- Drop the old unrestricted super admin policies on leads
DROP POLICY IF EXISTS "Super admins manage all leads" ON public.leads;
DROP POLICY IF EXISTS "Users view authorized leads" ON public.leads;

-- The "Super admins manage org leads" policy already exists and correctly restricts super admins to their own org