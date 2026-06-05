grant usage on schema public to service_role;

grant select, insert, update, delete on table public.facebook_pages to service_role;
grant select, insert, update, delete on table public.social_platforms to service_role;

grant execute on function public.set_vault_key(text) to service_role;
grant execute on function public.vault_encrypt(text) to service_role;
grant execute on function public.vault_decrypt(text) to service_role;
