-- Add RLS policies for super admins to view all leads across organizations
CREATE POLICY "Super admins view all leads"
ON public.leads
FOR SELECT
USING (has_role(auth.uid(), 'super_admin') AND NOT is_impersonating(auth.uid()));

-- Add RLS policies for super admins to view all bookings across organizations
CREATE POLICY "Super admins view all bookings"
ON public.bookings
FOR SELECT
USING (has_role(auth.uid(), 'super_admin') AND NOT is_impersonating(auth.uid()));

-- Add RLS policies for super admins to view all orders across organizations
CREATE POLICY "Super admins view all orders"
ON public.orders
FOR SELECT
USING (has_role(auth.uid(), 'super_admin') AND NOT is_impersonating(auth.uid()));