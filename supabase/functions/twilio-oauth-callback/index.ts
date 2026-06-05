import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const twilioClientId = Deno.env.get('TWILIO_CLIENT_ID') || '';
const twilioClientSecret = Deno.env.get('TWILIO_CLIENT_SECRET') || '';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

export const handler = async (req: Request): Promise<Response> => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('[Twilio OAuth] User denied access:', error);
      return new Response(
        `<html><body><h1>Authorization Denied</h1><p>Error: ${error}</p><p><a href="/settings">Return to Settings</a></p></body></html>`,
        {
          status: 400,
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }

    if (!code) {
      return new Response('Missing authorization code', { status: 400 });
    }

    if (!state) {
      console.warn('[Twilio OAuth] Missing state parameter');
      return new Response('Invalid state parameter', { status: 400 });
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://oauth.twilio.com/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${twilioClientId}:${twilioClientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${url.protocol}//${url.host}/functions/v1/twilio-oauth-callback`,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('[Twilio OAuth] Token exchange failed:', errorData);
      return new Response(
        `<html><body><h1>Token Exchange Failed</h1><p>${errorData}</p><p><a href="/settings">Return to Settings</a></p></body></html>`,
        {
          status: 400,
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }

    const tokens: TokenResponse = await tokenResponse.json();

    // Parse state to get organization_id
    let organizationId: string;
    try {
      const stateData = JSON.parse(atob(state));
      organizationId = stateData.organization_id;
    } catch {
      console.error('[Twilio OAuth] Invalid state format');
      return new Response('Invalid state format', { status: 400 });
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Store encrypted token in organizations table and enable Twilio
    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        twilio_enabled: true,
        twilio_oauth_token: `vault:${tokens.access_token}`,
        twilio_oauth_refresh_token: tokens.refresh_token ? `vault:${tokens.refresh_token}` : null,
        twilio_oauth_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      })
      .eq('id', organizationId);

    if (updateError) {
      console.error('[Twilio OAuth] Failed to store token:', updateError);
      return new Response(
        `<html><body><h1>Storage Error</h1><p>Failed to store authorization token</p><p><a href="/settings">Return to Settings</a></p></body></html>`,
        {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }

    // Success - redirect back to settings
    return new Response(
      `<html><body><h1>Success!</h1><p>Twilio account connected successfully.</p><p><a href="/settings">Return to Settings</a></p><script>window.close();</script></body></html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  } catch (error) {
    console.error('[Twilio OAuth] Unexpected error:', error);
    return new Response(
      `<html><body><h1>Error</h1><p>${error instanceof Error ? error.message : 'Unknown error'}</p><p><a href="/settings">Return to Settings</a></p></body></html>`,
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }
};
