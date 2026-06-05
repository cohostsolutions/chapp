begin;

create or replace function public.get_effective_role(uid uuid)
returns public.app_role
language sql
stable
set search_path = public
as $function$
  select coalesce(
    (select impersonated_role from public.profiles where id = uid),
    (select user_role from public.profiles where id = uid)
  );
$function$;

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
set search_path = public
as $function$
  select public.get_effective_role(auth.uid());
$function$;

create or replace function public.profiles_impersonation_enforce()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.user_role = 'super_admin'::public.app_role then
    if new.impersonated_role not in ('client_admin'::public.app_role, 'agent'::public.app_role) then
      new.impersonated_role := null;
    end if;
  else
    new.impersonated_role := null;
  end if;
  return new;
end;
$function$;

commit;