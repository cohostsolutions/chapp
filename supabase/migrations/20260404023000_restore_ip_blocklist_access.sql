begin;

grant select, insert, update, delete on public.ip_blocklist to authenticated;

commit;