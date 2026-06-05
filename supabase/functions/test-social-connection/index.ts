import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initVault, vaultDecrypt } from "../_shared/vault.ts";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface TestConnectionRequest {
  platformId: string;
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Initialize vault
    const vaultEnabled = await initVault(supabase);
    console.log('[Test Connection] Vault enabled:', vaultEnabled);
    
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { platformId }: TestConnectionRequest = await req.json();

    if (!platformId) {
      return new Response(JSON.stringify({ error: 'Missing platformId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Test Connection] Testing platform: ${platformId}`);

    // Get platform config
    const { data: platform, error: platformError } = await supabase
      .from('social_platforms')
      .select('*')
      .eq('id', platformId)
      .single();

    if (platformError || !platform) {
      console.error('[Test Connection] Platform not found:', platformError);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Platform not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const credentials = platform.credentials as Record<string, string>;
    let accessToken = credentials?.access_token;

    if (!accessToken) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'No access token configured',
        details: 'Please reconnect this account via Facebook.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Decrypt token if encrypted
    if (accessToken.startsWith('vault:')) {
      try {
        accessToken = await vaultDecrypt(supabase, accessToken);
      } catch (decryptError) {
        console.error('[Test Connection] Failed to decrypt token:', decryptError);
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Failed to decrypt credentials',
          details: 'Please reconnect this account.'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let testResult: { success: boolean; message: string; details?: Record<string, unknown> };

    if (platform.platform === 'instagram') {
      // Test Instagram connection by fetching account info
      const igAccountId = credentials.instagram_account_id;
      if (!igAccountId) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Instagram account ID not configured'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[Test Connection] Testing Instagram account: ${igAccountId}`);
      
      const igRes = await fetch(
        `https://graph.facebook.com/v18.0/${igAccountId}?fields=id,username,name,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`
      );
      const igJson = await igRes.json();

      if (!igRes.ok) {
        console.error('[Test Connection] Instagram API error:', igJson);
        testResult = {
          success: false,
          message: igJson.error?.message || 'Failed to connect to Instagram API',
          details: {
            error_code: igJson.error?.code,
            error_type: igJson.error?.type
          }
        };
      } else {
        console.log('[Test Connection] Instagram connection successful:', igJson);
        testResult = {
          success: true,
          message: `Connected as @${igJson.username || igJson.name || igAccountId}`,
          details: {
            id: igJson.id,
            username: igJson.username,
            name: igJson.name
          }
        };
      }

    } else if (platform.platform === 'whatsapp') {
      // Test WhatsApp connection by fetching phone number info
      const phoneNumberId = credentials.phone_number_id;
      if (!phoneNumberId) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'WhatsApp phone number ID not configured'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[Test Connection] Testing WhatsApp phone: ${phoneNumberId}`);
      
      const waRes = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating&access_token=${encodeURIComponent(accessToken)}`
      );
      const waJson = await waRes.json();

      if (!waRes.ok) {
        console.error('[Test Connection] WhatsApp API error:', waJson);
        testResult = {
          success: false,
          message: waJson.error?.message || 'Failed to connect to WhatsApp API',
          details: {
            error_code: waJson.error?.code,
            error_type: waJson.error?.type
          }
        };
      } else {
        console.log('[Test Connection] WhatsApp connection successful:', waJson);
        testResult = {
          success: true,
          message: `Connected: ${waJson.display_phone_number || phoneNumberId}`,
          details: {
            id: waJson.id,
            phone_number: waJson.display_phone_number,
            verified_name: waJson.verified_name,
            quality_rating: waJson.quality_rating
          }
        };
      }

    } else if (platform.platform === 'facebook') {
      // Test Facebook page connection
      const pageId = credentials.page_id;
      if (!pageId) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Facebook page ID not configured'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[Test Connection] Testing Facebook page: ${pageId}`);
      
      const fbRes = await fetch(
        `https://graph.facebook.com/v18.0/${pageId}?fields=id,name,access_token&access_token=${encodeURIComponent(accessToken)}`
      );
      const fbJson = await fbRes.json();

      if (!fbRes.ok) {
        console.error('[Test Connection] Facebook API error:', fbJson);
        testResult = {
          success: false,
          message: fbJson.error?.message || 'Failed to connect to Facebook API',
          details: {
            error_code: fbJson.error?.code,
            error_type: fbJson.error?.type
          }
        };
      } else {
        console.log('[Test Connection] Facebook connection successful:', fbJson);
        testResult = {
          success: true,
          message: `Connected to: ${fbJson.name || pageId}`,
          details: {
            id: fbJson.id,
            name: fbJson.name
          }
        };
      }

    } else {
      testResult = {
        success: false,
        message: `Unsupported platform: ${platform.platform}`
      };
    }

    return new Response(JSON.stringify(testResult), {
      status: testResult.success ? 200 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[Test Connection] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
