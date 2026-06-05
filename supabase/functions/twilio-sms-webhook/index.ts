import { serve } from "std/http/server";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { verifyTwilioSignature } from "../_shared/twilio-signature.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Twilio Inbound SMS Webhook
 * Receives SMS messages from Twilio and saves them to communications table
 * 
 * Twilio sends a POST request with form-encoded body containing:
 * - MessageSid: Unique message identifier
 * - AccountSid: Twilio account SID
 * - From: Sender's phone number
 * - To: Recipient's phone number (your number)
 * - Body: Message content
 * - NumMedia: Number of attachments
 * - MediaUrl0, MediaUrl1, etc: URLs to media if present
 */
serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Verify Twilio signature
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    if (authToken) {
      const isValid = await verifyTwilioSignature(req, authToken);
      if (!isValid) {
        console.error('[twilio-sms-webhook] Signature verification failed - rejecting request');
        return new Response('Unauthorized', { status: 403 });
      }
    } else {
      console.warn('[twilio-sms-webhook] TWILIO_AUTH_TOKEN not configured - skipping signature verification');
    }

    // Parse form-encoded body from Twilio
    const formData = await req.formData();
    const messageSid = formData.get('MessageSid')?.toString() || '';
    const accountSid = formData.get('AccountSid')?.toString() || '';
    const from = formData.get('From')?.toString() || '';
    const to = formData.get('To')?.toString() || '';
    const body = formData.get('Body')?.toString() || '';
    const numMedia = parseInt(formData.get('NumMedia')?.toString() || '0', 10);

    console.log(`[twilio-sms-webhook] Received SMS from ${from} to ${to}. MessageSid: ${messageSid}`);

    if (!messageSid || !from || !to || !body) {
      console.error('[twilio-sms-webhook] Missing required fields');
      return new Response('Missing required fields', { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find the organization and lead by matching the recipient phone number
    const { data: phoneNumbers } = await supabase
      .from('phone_numbers')
      .select('organization_id')
      .eq('phone_number', to)
      .eq('is_active', true)
      .maybeSingle();

    if (!phoneNumbers) {
      console.warn(`[twilio-sms-webhook] No organization found for phone number ${to}`);
      // Still return 200 to Twilio so it doesn't retry
      return new Response(JSON.stringify({ success: true, message: 'Phone number not found in system' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const organizationId = phoneNumbers.organization_id;

    // Find the lead by phone number
    const { data: lead } = await supabase
      .from('leads')
      .select('id, name')
      .eq('organization_id', organizationId)
      .or(`phone.eq.${from},phone.eq.${from.replace('+1', '')}`) // Match with and without country code
      .maybeSingle();

    if (!lead) {
      console.warn(`[twilio-sms-webhook] No lead found for phone ${from} in org ${organizationId}`);
      // Return success - message is from unknown number
      // Could implement auto-lead creation here if desired
      return new Response(JSON.stringify({ success: true, message: 'Lead not found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Collect media URLs if present
    const mediaUrls: string[] = [];
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = formData.get(`MediaUrl${i}`)?.toString();
      if (mediaUrl) mediaUrls.push(mediaUrl);
    }

    // Prepare metadata
    const metadata: Record<string, unknown> = {
      twilio_message_sid: messageSid,
      twilio_account_sid: accountSid,
    };
    if (mediaUrls.length > 0) {
      metadata.media_urls = mediaUrls;
    }

    // Save inbound SMS to communications table
    const { data: communication, error: saveError } = await supabase
      .from('communications')
      .insert({
        organization_id: organizationId,
        lead_id: lead.id,
        channel: 'sms',
        direction: 'inbound',
        role: 'customer',
        content: body,
        status: 'received',
        external_id: messageSid,
        metadata,
      })
      .select()
      .maybeSingle();

    if (saveError) {
      console.error('[twilio-sms-webhook] Failed to save communication:', saveError);
      // Still return 200 to prevent Twilio retry
      return new Response(JSON.stringify({ error: 'Failed to save message', saved: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[twilio-sms-webhook] Saved SMS from lead ${lead.id} to communication ${communication?.id}`);

    // Optional: Trigger AI response
    // You could call an AI chat function here to auto-respond
    // const { data: aiResponse } = await supabase.functions.invoke('ai-chat', {
    //   body: { lead_id: lead.id, message: body, channel: 'sms' }
    // });

    return new Response(JSON.stringify({ success: true, communication_id: communication?.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[twilio-sms-webhook] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
