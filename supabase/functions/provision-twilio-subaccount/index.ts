import { serve } from "std/http/server";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { verifyAuth, createAuthErrorResponse } from "../_shared/auth-guard.ts";
import { initVault, vaultEncrypt, vaultDecrypt } from "../_shared/vault.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

/**
 * Provision a Twilio Subaccount for a new organization
 * Called by an org creation trigger or manually via API
 * 
 * POST body: { organization_id: uuid }
 */
serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    // For internal trigger calls, allow service role
    const authHeader = req.headers.get('authorization');
    const isInternalTrigger = req.headers.get('x-internal-trigger') === 'true';

    let isAuthorized = isInternalTrigger;
    if (!isInternalTrigger && authHeader) {
      const auth = await verifyAuth(authHeader, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY);
      // Only super admins can manually provision
      isAuthorized = auth?.isSuperAdmin ?? false;
    }

    if (!isAuthorized) {
      return createAuthErrorResponse('Unauthorized', corsHeaders);
    }

    const body = await req.json();
    const { organization_id } = body;

    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if org already has a subaccount
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: org } = await supabase
      .from('organizations')
      .select('id, twilio_subaccount_sid, twilio_oauth_token')
      .eq('id', organization_id)
      .maybeSingle();

    if (!org) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Skip if already provisioned
    if (org.twilio_subaccount_sid) {
      console.log(`[provision-twilio-subaccount] Org ${organization_id} already has subaccount`);
      return new Response(JSON.stringify({ success: true, message: 'Already provisioned' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if OAuth token is connected
    if (!org.twilio_oauth_token) {
      return new Response(
        JSON.stringify({ error: 'Twilio OAuth token not configured. Admin must connect Twilio account.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Decrypt OAuth token
    await initVault(supabase);
    let oauthToken = org.twilio_oauth_token;
    if (oauthToken.startsWith('vault:')) {
      oauthToken = await vaultDecrypt(supabase, oauthToken);
    }

    // Create subaccount via Twilio API using OAuth token
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts.json`;

    const form = new URLSearchParams({
      FriendlyName: `Org-${organization_id}`,
    });

    console.log(`[provision-twilio-subaccount] Creating subaccount for org ${organization_id} using OAuth token`);

    const twilioResp = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${oauthToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    });

    const twilioResult = await twilioResp.json();

    if (!twilioResp.ok) {
      console.error('[provision-twilio-subaccount] Twilio error:', twilioResult);
      return new Response(
        JSON.stringify({ error: twilioResult.message || 'Failed to create subaccount' }),
        { status: twilioResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subaccountSid = twilioResult.sid;
    const subaccountAuthToken = twilioResult.auth_token;

    // Initialize vault and encrypt credentials
    await initVault(supabase);
    const encryptedSid = await vaultEncrypt(supabase, subaccountSid);
    const encryptedToken = await vaultEncrypt(supabase, subaccountAuthToken);

    // Store encrypted credentials in organizations table
    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        twilio_subaccount_sid: encryptedSid,
        twilio_auth_token: encryptedToken,
      })
      .eq('id', organization_id);

    if (updateError) {
      console.error('[provision-twilio-subaccount] Update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to store credentials' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[provision-twilio-subaccount] Successfully provisioned subaccount ${subaccountSid} for org ${organization_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        subaccount_sid: subaccountSid,
        message: 'Subaccount provisioned successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[provision-twilio-subaccount] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
