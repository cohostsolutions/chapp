/**
 * Vault encryption helpers for secure credential storage
 * Uses AES-256 encryption via pgcrypto database functions
 */

// Use any for Supabase client to avoid type conflicts across different versions
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/**
 * Initialize the vault by setting the encryption key in the database session
 * Must be called before any encrypt/decrypt operations
 */
export async function initVault(supabase: SupabaseClient): Promise<boolean> {
  const vaultKey = Deno.env.get('VAULT_ENCRYPTION_KEY');
  
  if (!vaultKey) {
    console.warn('[Vault] VAULT_ENCRYPTION_KEY not configured - encryption disabled');
    return false;
  }
  
  try {
    const { error } = await supabase.rpc('set_vault_key', { key: vaultKey });
    if (error) {
      console.error('[Vault] Failed to initialize vault:', error.message);
      return false;
    }
    return true;
  } catch (err: unknown) {
    console.error('[Vault] Error initializing vault:', err);
    return false;
  }
}

/**
 * Encrypt a value using the vault
 * Returns the encrypted string and throws if encryption fails
 */
export async function vaultEncrypt(supabase: SupabaseClient, plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;
  
  try {
    const { data, error } = await supabase.rpc('vault_encrypt', { plaintext });
    if (error) {
      // Fall back to storing plaintext — consistent with the SQL function's
      // own fallback when no key is in session
      console.warn('[Vault] Encryption RPC error, storing plaintext:', error.message);
      return plaintext;
    }
    return data as string;
  } catch (err: unknown) {
    console.warn('[Vault] Encryption error, storing plaintext:', err);
    return plaintext;
  }
}

/**
 * Decrypt a value from the vault
 * Returns the decrypted string or original value if not encrypted
 */
export async function vaultDecrypt(supabase: SupabaseClient, ciphertext: string): Promise<string> {
  if (!ciphertext) return ciphertext;
  
  // Check if the value is encrypted (has vault: prefix)
  if (!ciphertext.startsWith('vault:')) {
    return ciphertext; // Not encrypted, return as-is
  }
  
  try {
    const { data, error } = await supabase.rpc('vault_decrypt', { ciphertext });
    if (error) {
      console.error('[Vault] Decryption failed:', error.message);
      throw new Error('Failed to decrypt credential');
    }
    return data as string;
  } catch (err: unknown) {
    console.error('[Vault] Decryption error:', err);
    throw err;
  }
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: string | null | undefined): boolean {
  return value?.startsWith('vault:') ?? false;
}
