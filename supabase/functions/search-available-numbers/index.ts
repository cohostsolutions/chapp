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

const searchSchema = z.object({
  country_code: z.string().min(2),
  area_code: z.string().optional(),
  type: z.enum(['local','mobile','tollfree']).optional().default('local'),
});

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get('authorization');
    const auth = await verifyAuth(authHeader, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY);
    if (!auth) return createAuthErrorResponse('Unauthorized', corsHeaders);

    const requestedOrgId = new URL(req.url).searchParams.get('org_id');
    let orgId: string;
    try {
      orgId = enforceOrganizationAccess(auth, requestedOrgId);
    } catch (err) {
      return createAuthErrorResponse(err instanceof Error ? err : String(err), corsHeaders);
    }

    const body = await req.json();
    const parsed = searchSchema.safeParse(body);
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

    const { country_code, area_code, type } = parsed.data;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await initVault(supabase);

    // Fetch org and check if Twilio is enabled
    const { data: org } = await supabase
      .from('organizations')
      .select('twilio_enabled, twilio_subaccount_sid, twilio_auth_token')
      .eq('id', orgId)
      .maybeSingle();

    if (!org?.twilio_enabled) {
      return new Response(
        JSON.stringify({ error: 'Twilio phone number management is not enabled for this organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let subaccountSid = org.twilio_subaccount_sid as string | null;
    let subaccountToken = org.twilio_auth_token as string | null;

    if (subaccountSid && subaccountSid.startsWith('vault:')) {
      subaccountSid = await vaultDecrypt(supabase, subaccountSid);
    }
    if (subaccountToken && subaccountToken.startsWith('vault:')) {
      subaccountToken = await vaultDecrypt(supabase, subaccountToken);
    }

    if (!subaccountSid || !subaccountToken) {
      return new Response(JSON.stringify({ error: 'Twilio subaccount not provisioned for this organization' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${subaccountSid}/AvailablePhoneNumbers/${country_code}`;
    const path = type === 'tollfree' ? 'TollFree' : (type === 'mobile' ? 'Mobile' : 'Local');
    const url = `${baseUrl}/${path}.json` + (area_code ? `?AreaCode=${encodeURIComponent(area_code)}` : '');
    const authBasic = btoa(`${subaccountSid}:${subaccountToken}`);

    const resp = await fetch(url, {
      headers: { 'Authorization': `Basic ${authBasic}` },
    });
    const data = await resp.json();
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: data.message || 'Failed to search numbers' }), {
        status: resp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Quota: check if org has 0 numbers, mark results as Free
    const { count } = await supabase
      .from('phone_numbers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_active', true);

    const freeEligible = (count ?? 0) === 0;

    type TwilioAvailableNumber = {
      phone_number: string;
      friendly_name?: string;
      locality?: string;
      region?: string;
      iso_country?: string;
      area_code?: string;
    };
    const results = ((data?.available_phone_numbers as TwilioAvailableNumber[]) || []).map((n) => ({
      phone_number: n.phone_number,
      friendly_name: n.friendly_name,
      locality: n.locality,
      region: n.region,
      iso_country: n.iso_country,
      area_code: n.area_code,
      price_display: freeEligible ? '$0.00' : undefined,
      free_eligible: freeEligible,
    }));

    return new Response(JSON.stringify({ numbers: results, free_eligible: freeEligible }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[search-available-numbers] Error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
