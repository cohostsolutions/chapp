import { serve } from "std/http/server";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { verifyTwilioSignature } from "../_shared/twilio-signature.ts";

/**
 * TwiML Voice Webhook
 * This endpoint is called by Twilio when a call is initiated from the browser.
 * It returns TwiML instructions to connect the call to the destination number.
 */
serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    if (!twilioAuthToken) {
      console.error('[twilio-voice-webhook] TWILIO_AUTH_TOKEN not configured');
      const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Call cannot be completed. Voice webhook verification is not configured.</Say>
</Response>`;
      return new Response(errorTwiml, {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/xml' }
      });
    }

    const isValidSignature = await verifyTwilioSignature(req, twilioAuthToken);
    if (!isValidSignature) {
      console.warn('[twilio-voice-webhook] Rejected request with invalid Twilio signature');
      const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Call cannot be completed.</Say>
</Response>`;
      return new Response(errorTwiml, {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/xml' }
      });
    }

    // Parse form data from Twilio
    const formData = await req.formData();
    const to = formData.get('To')?.toString() || '';
    const from = formData.get('From')?.toString() || '';
    const callSid = formData.get('CallSid')?.toString() || '';
    
    console.log('[twilio-voice-webhook] Received:', { to, from, callSid });

    // Get the caller ID from environment
    const callerId = Deno.env.get('TWILIO_PHONE_NUMBER') || Deno.env.get('TWILIO_CALLER_ID');
    
    if (!callerId) {
      console.error('[twilio-voice-webhook] No caller ID configured');
      const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Call cannot be completed. Caller ID is not configured.</Say>
</Response>`;
      return new Response(errorTwiml, {
        headers: { ...corsHeaders, 'Content-Type': 'application/xml' }
      });
    }

    // If no destination number, return error
    if (!to) {
      const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>No destination number provided.</Say>
</Response>`;
      return new Response(errorTwiml, {
        headers: { ...corsHeaders, 'Content-Type': 'application/xml' }
      });
    }

    // The client should send an E.164-style number already. Keep normalization generic here.
    let cleanNumber = to.replace(/[^\d+]/g, '');
    if (cleanNumber.startsWith('00')) {
      cleanNumber = `+${cleanNumber.slice(2)}`;
    }
    if (!cleanNumber.startsWith('+') && /^\d+$/.test(cleanNumber)) {
      cleanNumber = `+${cleanNumber}`;
    }

    console.log(`[twilio-voice-webhook] Connecting to: ${cleanNumber} with caller ID: ${callerId}`);

    // Generate TwiML to dial the number
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}" timeout="30" answerOnBridge="true">
    <Number>${cleanNumber}</Number>
  </Dial>
</Response>`;

    return new Response(twiml, {
      headers: { ...corsHeaders, 'Content-Type': 'application/xml' }
    });
  } catch (error) {
    console.error('[twilio-voice-webhook] Error:', error);
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred processing your call.</Say>
</Response>`;
    return new Response(errorTwiml, {
      headers: { ...corsHeaders, 'Content-Type': 'application/xml' }
    });
  }
});
