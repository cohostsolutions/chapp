import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

// Helper to safely extract Zod validation errors
function getValidationErrors(result: { success: boolean; error?: z.ZodError }): z.ZodIssue[] {
  return result.success ? [] : (result.error?.issues || []);
}
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Input validation schema
const smsRequestSchema = z.object({
  leadId: z.string().uuid({ message: "Invalid lead ID format" }),
  message: z.string()
    .min(1, { message: "Message cannot be empty" })
    .max(1600, { message: "Message exceeds SMS character limit" }),
  to: z.string().regex(/^\+?[1-9]\d{1,14}$/, { message: "Invalid phone number format" }).optional(),
  from: z.string().regex(/^\+?[1-9]\d{1,14}$/, { message: "Invalid phone number format" }).optional(),
});

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Log on startup to verify credentials are configured
const twilioConfigured = !!(Deno.env.get('TWILIO_ACCOUNT_SID') && Deno.env.get('TWILIO_AUTH_TOKEN') && Deno.env.get('TWILIO_PHONE_NUMBER'));
console.log(`[send-sms] Function initialized. Twilio configured: ${twilioConfigured}`);

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
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate request body
    const body = await req.json();
    const validationResult = smsRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errors = getValidationErrors(validationResult);
      console.error('Validation error:', errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request data', 
          details: errors.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { leadId, message, from, to } = validationResult.data;

    // Use service role client for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found or no organization assigned' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the lead and verify it belongs to the user's organization
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, phone, name, organization_id')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      console.error('Lead error:', leadError);
      return new Response(
        JSON.stringify({ error: 'Lead not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify organization membership
    if (lead.organization_id !== profile.organization_id) {
      console.error('Organization mismatch:', { leadOrg: lead.organization_id, userOrg: profile.organization_id });
      return new Response(
        JSON.stringify({ error: 'Access denied: Lead does not belong to your organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetNumber = to || lead.phone;

    if (!targetNumber) {
      return new Response(
        JSON.stringify({ error: 'No phone number provided for this lead' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioNumber = from || Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !twilioNumber) {
      console.error('[send-sms] Missing Twilio credentials:', { 
        hasSid: !!accountSid, 
        hasToken: !!authToken, 
        hasNumber: !!twilioNumber 
      });
      return new Response(
        JSON.stringify({ error: 'Twilio credentials not configured. Please add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to your secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-sms] Sending SMS to lead ${lead.name} (${targetNumber}) from ${twilioNumber} by user ${user.id}`);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = btoa(`${accountSid}:${authToken}`);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: targetNumber,
        From: twilioNumber,
        Body: message,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[send-sms] Twilio API error:', { 
        status: response.status, 
        code: result.code, 
        message: result.message,
        moreInfo: result.more_info
      });
      return new Response(
        JSON.stringify({ error: result.message || 'Failed to send SMS', code: result.code }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[send-sms] SMS sent successfully:', { sid: result.sid, status: result.status });

    // Get user name for agent attribution
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();
    
    const senderName = userProfile?.full_name || userProfile?.email || 'Agent';

    // Log the outbound communication for auditability - role is 'agent' for human-sent messages
    const { data: communication, error: logError } = await supabase
      .from('communications')
      .insert({
        organization_id: profile.organization_id,
        lead_id: lead.id,
        channel: 'sms',
        direction: 'outbound',
        role: 'agent',
        content: message,
        status: result.status || 'sent',
        external_id: result.sid,
        user_id: user.id,
        metadata: { sender_name: senderName, sent_by_agent: true },
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to log SMS communication:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sid: result.sid,
        status: result.status,
        communication,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending SMS:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
