import { serve } from "std/http/server";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Simple JWT creation for Twilio Access Token
function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function createTwilioAccessToken(
  accountSid: string,
  apiKey: string,
  apiSecret: string,
  identity: string,
  outgoingApplicationSid: string,
  ttl: number = 3600
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  const header = {
    typ: 'JWT',
    alg: 'HS256',
    cty: 'twilio-fpa;v=1'
  };

  const grants: Record<string, unknown> = {
    identity: identity,
    voice: {
      outgoing: {
        application_sid: outgoingApplicationSid
      },
      incoming: {
        allow: true
      }
    }
  };

  const payload = {
    jti: `${apiKey}-${now}`,
    iss: apiKey,
    sub: accountSid,
    iat: now,
    exp: now + ttl,
    grants: grants
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const message = `${headerB64}.${payloadB64}`;
  
  // HMAC-SHA256 signature using Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(apiSecret);
  const messageData = encoder.encode(message);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const signatureB64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
  return `${message}.${signatureB64}`;
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    // Get the authorization header to identify the caller
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a client with the user's JWT to get their identity
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('[twilio-voice-token] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for Twilio credentials
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const apiKey = Deno.env.get('TWILIO_API_KEY');
    const apiSecret = Deno.env.get('TWILIO_API_SECRET');
    const twimlAppSid = Deno.env.get('TWILIO_TWIML_APP_SID');

    // Return configuration status if credentials are missing
    if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
      const missingSecrets = [];
      if (!accountSid) missingSecrets.push('TWILIO_ACCOUNT_SID');
      if (!apiKey) missingSecrets.push('TWILIO_API_KEY');
      if (!apiSecret) missingSecrets.push('TWILIO_API_SECRET');
      if (!twimlAppSid) missingSecrets.push('TWILIO_TWIML_APP_SID');
      
      console.log('[twilio-voice-token] Credentials not configured, returning simulation mode');
      return new Response(
        JSON.stringify({ 
          configured: false,
          simulationMode: true,
          missingSecrets,
          message: 'Twilio Voice is not configured. Running in simulation mode.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile for identity
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    // Create identity from user info
    const identity = profile?.full_name?.replace(/\s+/g, '_') || user.email?.split('@')[0] || user.id;

    console.log(`[twilio-voice-token] Generating token for user: ${identity}`);

    // Generate access token
    const token = await createTwilioAccessToken(
      accountSid,
      apiKey,
      apiSecret,
      identity,
      twimlAppSid,
      3600 // 1 hour TTL
    );

    return new Response(
      JSON.stringify({ 
        configured: true,
        simulationMode: false,
        token,
        identity,
        expiresIn: 3600
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[twilio-voice-token] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
