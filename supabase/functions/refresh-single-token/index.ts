import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initVault, vaultEncrypt, vaultDecrypt } from "../_shared/vault.ts";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const FACEBOOK_APP_ID = Deno.env.get('FACEBOOK_APP_ID');
const FACEBOOK_APP_SECRET = Deno.env.get('FACEBOOK_APP_SECRET');

Deno.serve(async (req: Request) => {
  const corsHeaders = createCorsHeaders(req);
  
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is super admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: callerRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isSuperAdmin = callerRoles?.some((r) => r.role === 'super_admin');
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Only super admins can refresh tokens manually' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { platformId } = await req.json();
    if (!platformId) {
      return new Response(JSON.stringify({ error: 'Missing platformId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize vault encryption
    const vaultEnabled = await initVault(supabaseAdmin);
    console.log('[Refresh Single Token] Vault encryption:', vaultEnabled ? 'enabled' : 'disabled');

    // Fetch the platform
    const { data: platform, error: fetchError } = await supabaseAdmin
      .from('social_platforms')
      .select('*')
      .eq('id', platformId)
      .single();

    if (fetchError || !platform) {
      return new Response(JSON.stringify({ error: 'Platform not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!['instagram', 'whatsapp'].includes(platform.platform)) {
      return new Response(JSON.stringify({ error: 'Token refresh only supported for Instagram and WhatsApp' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const credentials = (platform.credentials ?? {}) as Record<string, unknown>;
    if (!credentials?.access_token) {
      return new Response(JSON.stringify({ error: 'No access token found for this platform' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Refresh Single Token] Refreshing token for ${platform.platform} - ${platform.display_name}`);

    // Decrypt the current token
    let currentToken = String(credentials.access_token || '');
    if (vaultEnabled && currentToken) {
      try {
        currentToken = await vaultDecrypt(supabaseAdmin, currentToken);
      } catch (decryptErr) {
        console.error('[Refresh Single Token] Failed to decrypt token:', decryptErr);
        return new Response(JSON.stringify({ error: 'Failed to decrypt current token' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Exchange for new long-lived token
    const exchangeUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    exchangeUrl.searchParams.set('grant_type', 'fb_exchange_token');
    exchangeUrl.searchParams.set('client_id', FACEBOOK_APP_ID!);
    exchangeUrl.searchParams.set('client_secret', FACEBOOK_APP_SECRET!);
    exchangeUrl.searchParams.set('fb_exchange_token', currentToken);

    const exchangeResponse = await fetch(exchangeUrl.toString());
    
    if (!exchangeResponse.ok) {
      const errorText = await exchangeResponse.text();
      console.error('[Refresh Single Token] Token exchange failed:', errorText);
      return new Response(JSON.stringify({ 
        error: 'Token exchange failed', 
        details: errorText,
        suggestion: 'The token may be invalid or expired. Try reconnecting via Facebook.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const exchangeData = await exchangeResponse.json();
    let newAccessToken = exchangeData.access_token;
    const expiresIn = exchangeData.expires_in || 5184000; // Default 60 days

    // Encrypt the new token
    if (vaultEnabled) {
      newAccessToken = await vaultEncrypt(supabaseAdmin, newAccessToken);
    }

    // Calculate new expiry date
    const newExpiryDate = new Date();
    newExpiryDate.setSeconds(newExpiryDate.getSeconds() + expiresIn);

    // Update credentials with new token
    const updatedCredentials = {
      ...credentials,
      access_token: newAccessToken,
      token_expires_at: newExpiryDate.toISOString(),
    };

    const { error: updateError } = await supabaseAdmin
      .from('social_platforms')
      .update({ credentials: updatedCredentials })
      .eq('id', platform.id);

    if (updateError) {
      console.error('[Refresh Single Token] Failed to update token:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to save refreshed token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Refresh Single Token] Successfully refreshed token for ${platform.platform} - ${platform.display_name}, expires: ${newExpiryDate.toISOString()}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Token refreshed successfully. New expiry: ${newExpiryDate.toLocaleDateString()}`,
      expires_at: newExpiryDate.toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Refresh Single Token] Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: (error as Error).message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
