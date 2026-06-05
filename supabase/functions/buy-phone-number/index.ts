import { serve } from "std/http/server";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

// Helper to safely extract Zod validation errors
function getValidationErrors(result: { success: boolean; error?: z.ZodError }): z.ZodIssue[] {
  return result.success ? [] : (result.error?.issues || []);
}
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { verifyAuth, enforceOrganizationAccess, createAuthErrorResponse } from "../_shared/auth-guard.ts";
import { initVault, vaultDecrypt } from "../_shared/vault.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Input validation
const buyRequestSchema = z.object({
  phoneNumber: z.string().min(7),
  country_code: z.string().optional(),
  area_code: z.string().optional(),
});

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get('authorization');
    const supabaseAnonKey = SUPABASE_ANON_KEY;
    const supabaseServiceKey = SUPABASE_SERVICE_ROLE_KEY;

    const auth = await verifyAuth(authHeader, SUPABASE_URL, supabaseAnonKey, supabaseServiceKey);
    if (!auth) {
      return createAuthErrorResponse('Unauthorized', corsHeaders);
    }

    // Determine organization context and enforce tenant isolation
    const requestedOrgId = new URL(req.url).searchParams.get('org_id');
    let orgId: string;
    try {
      orgId = enforceOrganizationAccess(auth, requestedOrgId);
    } catch (err) {
      return createAuthErrorResponse(err instanceof Error ? err : String(err), corsHeaders);
    }

    // Parse and validate body
    const body = await req.json();
    const parsed = buyRequestSchema.safeParse(body);
    if (!parsed.success) {
      const errors = getValidationErrors(parsed);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request', 
          details: errors.map(i => `${i.path.join('.')}: ${i.message}`).join(', ') 
        }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { phoneNumber } = parsed.data;

    // Use service role for DB ops
    const supabase = createClient(SUPABASE_URL, supabaseServiceKey);

    // Initialize vault for decryption
    await initVault(supabase);

    // Get Twilio subaccount credentials and check if enabled
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, twilio_enabled, twilio_subaccount_sid, twilio_auth_token')
      .eq('id', orgId)
      .maybeSingle();

    if (orgError || !org) {
      console.error('[buy-phone-number] Org fetch error:', orgError);
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!org.twilio_enabled) {
      return new Response(
        JSON.stringify({ error: 'Twilio phone number management is not enabled for this organization' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // QUOTA CHECK: Enforce 1 free number per organization
    const { count, error: countError } = await supabase
      .from('phone_numbers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_active', true);

    if (countError) {
      console.error('[buy-phone-number] Count error:', countError);
      return new Response(JSON.stringify({ error: 'Failed to check quota' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if ((count ?? 0) >= 1) {
      return new Response(JSON.stringify({ 
        error: 'Free limit reached. Please contact support to add additional lines.',
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let subaccountSid = org.twilio_subaccount_sid as string | null;
    let subaccountToken = org.twilio_auth_token as string | null;

    // Decrypt if needed
    if (subaccountSid && subaccountSid.startsWith('vault:')) {
      subaccountSid = await vaultDecrypt(supabase, subaccountSid);
    }
    if (subaccountToken && subaccountToken.startsWith('vault:')) {
      subaccountToken = await vaultDecrypt(supabase, subaccountToken);
    }

    if (!subaccountSid || !subaccountToken) {
      console.error('[buy-phone-number] Missing Twilio subaccount credentials');
      return new Response(JSON.stringify({ error: 'Twilio subaccount not provisioned for this organization' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Configure webhook URLs
    const voiceUrl = `${SUPABASE_URL}/functions/v1/twilio-voice-webhook`;
    const smsUrl = `${SUPABASE_URL}/functions/v1/social-webhook`; // placeholder for SMS webhook handler

    // Purchase the number via Twilio IncomingPhoneNumbers API on subaccount
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${subaccountSid}/IncomingPhoneNumbers.json`;
    const authBasic = btoa(`${subaccountSid}:${subaccountToken}`);

    const form = new URLSearchParams({
      PhoneNumber: phoneNumber,
      VoiceUrl: voiceUrl,
      SmsUrl: smsUrl,
    });

    const twilioResp = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authBasic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    });

    const twilioResult = await twilioResp.json();
    if (!twilioResp.ok) {
      console.error('[buy-phone-number] Twilio error:', twilioResult);
      const message = twilioResult.message || 'Failed to purchase number';
      return new Response(JSON.stringify({ error: message, code: twilioResult.code }), {
        status: twilioResp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Persist the purchased number
    const insertPayload = {
      organization_id: orgId,
      twilio_sid: twilioResult.sid,
      phone_number: twilioResult.phone_number || phoneNumber,
      country_code: twilioResult.country || null,
      area_code: twilioResult.area_code || null,
      is_active: true,
    };

    const { data: saved, error: saveError } = await supabase
      .from('phone_numbers')
      .insert(insertPayload)
      .select()
      .maybeSingle();

    if (saveError) {
      console.error('[buy-phone-number] Save error:', saveError);
    }

    return new Response(JSON.stringify({ success: true, number: saved ?? insertPayload }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[buy-phone-number] Error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
