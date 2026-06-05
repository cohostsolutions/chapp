-- Helper function so edge functions can reliably read Supabase Vault secrets
-- via supabase.rpc() without needing direct schema access to vault.decrypted_secrets.
-- SECURITY DEFINER runs as the function owner (postgres superuser) which has
-- the necessary grants on the vault schema.
CREATE OR REPLACE FUNCTION public.get_vault_secret(p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
BEGIN
  RETURN (
    SELECT decrypted_secret
    FROM vault.decrypted_secrets
    WHERE name = p_name
    LIMIT 1
  );
END;
$$;

-- Only service-role and superusers should call this; revoke from public/anon.
REVOKE ALL ON FUNCTION public.get_vault_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vault_secret(text) TO service_role;
