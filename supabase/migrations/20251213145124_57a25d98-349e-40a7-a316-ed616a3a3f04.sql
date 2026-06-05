-- Drop existing agent-restrictive policies for orders
DROP POLICY IF EXISTS "Users view authorized orders" ON public.orders;
DROP POLICY IF EXISTS "Agents manage assigned lead orders" ON public.orders;

-- Create new SELECT policy for orders
CREATE POLICY "Users view authorized orders" 
ON public.orders 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()))
  OR (
    has_role(auth.uid(), 'agent'::app_role) 
    AND organization_id = get_user_org(auth.uid())
    AND (
      org_uses_shared_access(organization_id)
      OR is_assigned_to_lead(auth.uid(), lead_id)
    )
  )
);

-- Create new ALL policy for agents on orders
DROP POLICY IF EXISTS "Agents manage authorized orders" ON public.orders;

CREATE POLICY "Agents manage authorized orders" 
ON public.orders 
FOR ALL 
USING (
  has_role(auth.uid(), 'agent'::app_role)
  AND organization_id = get_user_org(auth.uid())
  AND (
    org_uses_shared_access(organization_id)
    OR is_assigned_to_lead(auth.uid(), lead_id)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'agent'::app_role)
  AND organization_id = get_user_org(auth.uid())
  AND (
    org_uses_shared_access(organization_id)
    OR is_assigned_to_lead(auth.uid(), lead_id)
  )
);

-- Drop existing agent-restrictive policies for bookings
DROP POLICY IF EXISTS "Users view authorized bookings" ON public.bookings;
DROP POLICY IF EXISTS "Agents manage assigned lead bookings" ON public.bookings;

-- Create new SELECT policy for bookings
CREATE POLICY "Users view authorized bookings" 
ON public.bookings 
FOR SELECT 
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (has_role(auth.uid(), 'client_admin'::app_role) AND organization_id = get_user_org(auth.uid()))
  OR (
    has_role(auth.uid(), 'agent'::app_role) 
    AND organization_id = get_user_org(auth.uid())
    AND (
      org_uses_shared_access(organization_id)
      OR is_assigned_to_lead(auth.uid(), lead_id)
    )
  )
);

-- Create new ALL policy for agents on bookings
DROP POLICY IF EXISTS "Agents manage authorized bookings" ON public.bookings;

CREATE POLICY "Agents manage authorized bookings" 
ON public.bookings 
FOR ALL 
USING (
  has_role(auth.uid(), 'agent'::app_role)
  AND organization_id = get_user_org(auth.uid())
  AND (
    org_uses_shared_access(organization_id)
    OR is_assigned_to_lead(auth.uid(), lead_id)
  )
)
WITH CHECK (
  has_role(auth.uid(), 'agent'::app_role)
  AND organization_id = get_user_org(auth.uid())
  AND (
    org_uses_shared_access(organization_id)
    OR is_assigned_to_lead(auth.uid(), lead_id)
  )
);