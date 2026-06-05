DROP POLICY IF EXISTS "unified_kb_entries_policy" ON public.knowledge_base_entries;

CREATE POLICY "unified_kb_entries_policy"
ON public.knowledge_base_entries
AS PERMISSIVE
FOR ALL
TO public
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR organization_id = public.get_user_org(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR organization_id = public.get_user_org(auth.uid())
);

DROP POLICY IF EXISTS "unified_kb_documents_policy" ON public.knowledge_base_documents;

CREATE POLICY "unified_kb_documents_policy"
ON public.knowledge_base_documents
AS PERMISSIVE
FOR ALL
TO public
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR organization_id = public.get_user_org(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR organization_id = public.get_user_org(auth.uid())
);
