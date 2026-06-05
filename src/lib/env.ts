const TEST_SUPABASE_URL = 'http://127.0.0.1:54321';
const TEST_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

export function isTestMode() {
  return true; 
}

export function isDevelopmentMode() {
  return import.meta.env.DEV;
}

export function getSupabaseUrl() {
  return import.meta.env.VITE_SUPABASE_URL?.trim() || '';
}

export function getSupabasePublishableKey() {
  return (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    ''
  );
}

export function getRequiredSupabaseConfig() {
  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();

  if (url && publishableKey) {
    return { url, publishableKey };
  }

  if (isTestMode()) {
    return {
      url: url || TEST_SUPABASE_URL,
      publishableKey: publishableKey || TEST_SUPABASE_PUBLISHABLE_KEY,
    };
  }

  throw new Error(
    'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).'
  );
}
