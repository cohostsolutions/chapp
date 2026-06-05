import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SendReactionRequest {
  platform: 'whatsapp' | 'messenger' | 'instagram';
  messageId: string; // external_id of the message to react to
  emoji: string;
  action: 'react' | 'unreact';
  organizationId: string;
  communicationId: string; // our internal ID
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
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

    const { platform, messageId, emoji, action, organizationId, communicationId }: SendReactionRequest = await req.json();

    console.log(`[send-reaction] Starting: platform=${platform}, messageId=${messageId}, emoji=${emoji}, action=${action}`);

    // Get platform credentials
    const { data: platformConfig, error: configError } = await supabase
      .from('social_platforms')
      .select('credentials')
      .eq('organization_id', organizationId)
      .eq('platform', platform === 'messenger' ? 'facebook' : platform)
      .eq('is_enabled', true)
      .limit(1)
      .single();

    if (configError || !platformConfig) {
      console.error('[send-reaction] Platform not configured:', { platform, organizationId });
      return new Response(JSON.stringify({ 
        error: `${platform} is not configured for this organization.` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const credentials = platformConfig.credentials as { access_token: string; page_id: string };
    const accessToken = credentials.access_token;
    const pageId = credentials.page_id;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Platform credentials incomplete.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send reaction via platform API
    let success = false;

    if (platform === 'messenger' || platform === 'instagram') {
      // Meta doesn't support sending reactions from pages to user messages
      // This is a platform limitation - we can only receive reactions, not send them
      console.log('[send-reaction] Messenger/Instagram: Pages cannot send reactions via API (platform limitation)');
      return new Response(JSON.stringify({ 
        error: 'Sending reactions is not supported for Messenger/Instagram. This is a Meta platform limitation.',
        platformLimitation: true
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (platform === 'whatsapp') {
      // WhatsApp Cloud API - reactions ARE supported
      // Get the phone_number_id from credentials (WhatsApp uses this, not page_id)
      const phoneNumberId = ((platformConfig.credentials ?? {}) as Record<string, unknown>).phone_number_id || pageId;
      const apiUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

      // Get the lead phone from communication metadata or lead record
      const { data: comm, error: commError } = await supabase
        .from('communications')
        .select('lead_id, metadata')
        .eq('id', communicationId)
        .single();

      if (commError || !comm) {
        console.error('[send-reaction] Communication not found:', commError);
        return new Response(JSON.stringify({ error: 'Message not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Try to get phone from metadata first, then from lead record
      let recipientPhone = ((comm.metadata ?? {}) as Record<string, unknown>).sender_id;
      
      if (!recipientPhone && comm.lead_id) {
        const { data: lead } = await supabase
          .from('leads')
          .select('phone')
          .eq('id', comm.lead_id)
          .single();
        recipientPhone = lead?.phone;
      }

      if (!recipientPhone) {
        console.error('[send-reaction] No phone number found for recipient');
        return new Response(JSON.stringify({ error: 'Recipient phone number not found' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Clean up phone number (remove + prefix if present, WhatsApp expects just digits)
      const cleanPhone = String(recipientPhone).replace(/^\+/, '');

      const requestBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'reaction',
        reaction: {
          message_id: messageId,
          emoji: action === 'react' ? emoji : ''
        }
      };

      console.log('[send-reaction] WhatsApp request:', JSON.stringify(requestBody));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      
      if (response.ok) {
        success = true;
        console.log('[send-reaction] WhatsApp reaction sent successfully:', responseText);
      } else {
        console.error('[send-reaction] WhatsApp API error:', response.status, responseText);
        return new Response(JSON.stringify({ 
          error: 'Failed to send reaction to WhatsApp',
          details: responseText
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Update local metadata regardless of API success
    const { data: comm, error: findError } = await supabase
      .from('communications')
      .select('metadata')
      .eq('id', communicationId)
      .single();

    if (!findError && comm) {
      const metadata = (comm.metadata || {}) as Record<string, any>;
      const reactions = metadata.reactions || {};

      if (action === 'react') {
        if (!reactions[emoji]) {
          reactions[emoji] = [];
        }
        if (!reactions[emoji].includes(user.id)) {
          reactions[emoji].push(user.id);
        }
      } else {
        if (reactions[emoji]) {
          reactions[emoji] = reactions[emoji].filter((id: string) => id !== user.id);
          if (reactions[emoji].length === 0) {
            delete reactions[emoji];
          }
        }
      }

      await supabase
        .from('communications')
        .update({
          metadata: { ...metadata, reactions },
          updated_at: new Date().toISOString()
        })
        .eq('id', communicationId);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      sentToApi: success 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error sending reaction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
