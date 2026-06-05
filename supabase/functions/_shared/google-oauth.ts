import { initVault, vaultDecrypt, vaultEncrypt } from "./vault.ts";

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

interface GoogleOAuthConfig {
  clientId: string | null;
  clientSecret: string | null;
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  return {
    clientId: Deno.env.get('OAuth_Client_ID') ?? Deno.env.get('GOOGLE_CLIENT_ID'),
    clientSecret:
      Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')
      ?? Deno.env.get('GOOGLE_AUTH_CLIENT_SECRET')
      ?? Deno.env.get('GOOGLE_CLIENT_SECRET'),
  };
}

export async function getValidGoogleAccessToken(
  supabase: SupabaseClient,
  userId: string,
  config: GoogleOAuthConfig,
): Promise<string | null> {
  if (!config.clientId || !config.clientSecret) {
    return null;
  }

  const vaultEnabled = await initVault(supabase);
  const { data: tokenData, error } = await supabase
    .from('google_calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !tokenData) {
    return null;
  }

  let accessToken: string;
  let refreshToken: string;

  try {
    accessToken = await vaultDecrypt(supabase, tokenData.access_token);
    refreshToken = await vaultDecrypt(supabase, tokenData.refresh_token);
  } catch (decryptError) {
    console.error('[Google OAuth] Failed to decrypt stored token:', decryptError);
    await supabase.from('google_calendar_tokens').delete().eq('user_id', userId);
    return null;
  }

  const tokenExpiry = new Date(tokenData.token_expiry);
  if (tokenExpiry > new Date()) {
    return accessToken;
  }

  const refreshResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const refreshData = await refreshResponse.json();
  if (!refreshResponse.ok || refreshData.error) {
    console.error('[Google OAuth] Failed to refresh token:', refreshData);
    await supabase.from('google_calendar_tokens').delete().eq('user_id', userId);
    return null;
  }

  const encryptedAccessToken = vaultEnabled
    ? await vaultEncrypt(supabase, refreshData.access_token)
    : refreshData.access_token;

  const newExpiry = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();
  const { error: updateError } = await supabase
    .from('google_calendar_tokens')
    .update({
      access_token: encryptedAccessToken,
      token_expiry: newExpiry,
    })
    .eq('user_id', userId);

  if (updateError) {
    console.error('[Google OAuth] Failed to persist refreshed token:', updateError);
  }

  return refreshData.access_token as string;
}