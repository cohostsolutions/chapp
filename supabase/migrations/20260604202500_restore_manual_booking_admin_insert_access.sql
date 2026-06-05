GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.leads TO authenticated;

DROP POLICY IF EXISTS "Admins create org leads" ON public.leads;
CREATE POLICY "Admins create org leads"
ON public.leads
FOR INSERT
WITH CHECK (
  (
    public.has_role_text(auth.uid(), 'super_admin')
    OR public.has_role_text(auth.uid(), 'client_admin')
  )
  AND organization_id = public.get_user_org(auth.uid())
);

DROP POLICY IF EXISTS "Admins create org bookings" ON public.bookings;
CREATE POLICY "Admins create org bookings"
ON public.bookings
FOR INSERT
WITH CHECK (
  (
    public.has_role_text(auth.uid(), 'super_admin')
    OR public.has_role_text(auth.uid(), 'client_admin')
  )
  AND organization_id = public.get_user_org(auth.uid())
);
