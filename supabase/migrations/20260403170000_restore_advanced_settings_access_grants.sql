begin;

grant select on public.audit_logs to authenticated;
grant select, update on public.secret_rotation_tracking to authenticated;

commit;