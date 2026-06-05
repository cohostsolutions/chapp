-- Allow client admins to update their own organization settings (incl. sales_process_config)

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'organizations'
      AND policyname = 'Client admins update own org'
  ) THEN
    EXECUTE 'DROP POLICY "Client admins update own org" ON public.organizations';
  END IF;
END$$;

CREATE POLICY "Client admins update own org"
ON public.organizations
FOR UPDATE
USING (
  has_role(auth.uid(), 'client_admin'::app_role)
  AND id = get_user_org(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'client_admin'::app_role)
  AND id = get_user_org(auth.uid())
);
