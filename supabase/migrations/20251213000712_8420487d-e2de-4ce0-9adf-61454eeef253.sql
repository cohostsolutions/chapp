-- ============================================
-- VAULT ENCRYPTION FOR SENSITIVE CREDENTIALS
-- ============================================

-- Ensure pgcrypto extension is enabled (ignore if lacking privilege)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pgcrypto extension requires elevated privileges; skipping';
END $$;

-- Create a secure encryption function for storing sensitive data
-- Uses AES-256 encryption with the VAULT_ENCRYPTION_KEY
CREATE OR REPLACE FUNCTION public.vault_encrypt(plaintext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
  encrypted bytea;
BEGIN
  -- Get the encryption key from a secure location
  -- This function is only callable by service role
  encryption_key := current_setting('app.vault_key', true);
  
  IF encryption_key IS NULL OR encryption_key = '' THEN
    -- If no key in session, return the plaintext (fallback for migration)
    RETURN plaintext;
  END IF;
  
  -- Encrypt using AES-256
  encrypted := pgp_sym_encrypt(plaintext, encryption_key, 'cipher-algo=aes256');
  
  -- Return as base64 encoded string with prefix to identify encrypted values
  RETURN 'vault:' || encode(encrypted, 'base64');
END;
$$;

-- Create a secure decryption function for retrieving sensitive data
CREATE OR REPLACE FUNCTION public.vault_decrypt(ciphertext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
  encrypted bytea;
BEGIN
  -- Check if the value is encrypted (has vault: prefix)
  IF ciphertext IS NULL OR NOT ciphertext LIKE 'vault:%' THEN
    -- Return as-is if not encrypted (migration compatibility)
    RETURN ciphertext;
  END IF;
  
  -- Get the encryption key from session
  encryption_key := current_setting('app.vault_key', true);
  
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RAISE EXCEPTION 'Vault encryption key not configured';
  END IF;
  
  -- Decode from base64 (remove vault: prefix first)
  encrypted := decode(substring(ciphertext from 7), 'base64');
  
  -- Decrypt using AES-256
  RETURN pgp_sym_decrypt(encrypted, encryption_key);
END;
$$;

-- Create a helper function for edge functions to set the vault key
-- This should only be called by service role
CREATE OR REPLACE FUNCTION public.set_vault_key(key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.vault_key', key, false);
END;
$$;

-- Revoke execute from public, only service role should use these
REVOKE ALL ON FUNCTION public.vault_encrypt(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vault_decrypt(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_vault_key(text) FROM PUBLIC;

-- Grant to service role (postgres role has access by default)
GRANT EXECUTE ON FUNCTION public.vault_encrypt(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_decrypt(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_vault_key(text) TO service_role;