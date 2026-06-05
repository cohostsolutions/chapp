drop policy if exists "unified_training_modules_policy" on public.training_modules;
drop policy if exists "unified_rubric_templates_policy" on public.rubric_templates;

create policy "training_modules_read_policy"
on public.training_modules
as permissive
for select
to public
using (
  public.has_role((select auth.uid()), 'super_admin'::public.app_role)
  or organization_id = public.get_user_org((select auth.uid()))
);

create policy "training_modules_manage_policy"
on public.training_modules
as permissive
for all
to public
using (
  public.has_role((select auth.uid()), 'super_admin'::public.app_role)
  or (
    public.has_role((select auth.uid()), 'client_admin'::public.app_role)
    and organization_id = public.get_user_org((select auth.uid()))
  )
)
with check (
  public.has_role((select auth.uid()), 'super_admin'::public.app_role)
  or (
    public.has_role((select auth.uid()), 'client_admin'::public.app_role)
    and organization_id = public.get_user_org((select auth.uid()))
  )
);

create policy "rubric_templates_read_policy"
on public.rubric_templates
as permissive
for select
to public
using (
  public.has_role((select auth.uid()), 'super_admin'::public.app_role)
  or organization_id = public.get_user_org((select auth.uid()))
);

create policy "rubric_templates_manage_policy"
on public.rubric_templates
as permissive
for all
to public
using (
  public.has_role((select auth.uid()), 'super_admin'::public.app_role)
  or (
    public.has_role((select auth.uid()), 'client_admin'::public.app_role)
    and organization_id = public.get_user_org((select auth.uid()))
  )
)
with check (
  public.has_role((select auth.uid()), 'super_admin'::public.app_role)
  or (
    public.has_role((select auth.uid()), 'client_admin'::public.app_role)
    and organization_id = public.get_user_org((select auth.uid()))
  )
);