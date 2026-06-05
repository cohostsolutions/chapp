import { supabase } from '@/integrations/supabase/client';

export async function getSupabaseFunctionAuthHeaders() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  let session = data.session;

  const expiresAt = session?.expires_at ? session.expires_at * 1000 : null;
  const expiresSoon = expiresAt ? expiresAt <= Date.now() + 60_000 : true;

  if (!session || expiresSoon) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError) {
      throw refreshError;
    }

    session = refreshData.session;
  }

  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const publishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!publishableKey) {
    throw new Error('Missing Supabase publishable key for authenticated function calls.');
  }

  return {
    apikey: publishableKey,
    Authorization: `Bearer ${accessToken}`,
  };
}