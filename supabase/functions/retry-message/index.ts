import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { initVault, vaultDecrypt } from "../_shared/vault.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function getRoutingHint(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;

  const phoneNumberId = metadata.phone_number_id;
  if (typeof phoneNumberId === 'string' && phoneNumberId) return phoneNumberId;

  const instagramAccountId = metadata.instagram_account_id;
  if (typeof instagramAccountId === 'string' && instagramAccountId) return instagramAccountId;

  const pageId = metadata.page_id;
  return typeof pageId === 'string' && pageId ? pageId : null;
}

async function decryptTokenIfNeeded(token: string): Promise<string> {
  if (!token.startsWith('vault:')) return token;
  await initVault(supabase);
  return await vaultDecrypt(supabase, token);
}

serve(async (req: Request) => {
  const corsHeaders = createCorsHeaders(req);
  const logger = createLogger(req, 'retry-message');
  const start = Date.now();

  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const body = await req.json().catch(() => ({}));
    const commId = String((body as any).communicationId || (body as any).communication_id || '');
    if (!commId) return new Response(JSON.stringify({ error: 'communicationId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Fetch communication
    const { data: comm } = await supabase
      .from('communications')
      .select('*')
      .eq('id', commId)
      .single();

    if (!comm) return new Response(JSON.stringify({ error: 'communication not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Only retry outbound failed AI messages
    if (comm.direction !== 'outbound' || comm.status !== 'failed' || !(comm.metadata && (comm.metadata as any).is_ai_response)) {
      return new Response(JSON.stringify({ error: 'Not a failed AI outbound message' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get lead to determine recipient
    const { data: lead } = await supabase
      .from('leads')
      .select('id, platform_user_id, organization_id')
      .eq('id', comm.lead_id)
      .single();

    if (!lead) return new Response(JSON.stringify({ error: 'lead not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Determine platform from communication channel
    const channelPlatform = comm.channel?.toLowerCase() || 'messenger';
    const recipientId = lead.platform_user_id;
    if (!recipientId) return new Response(JSON.stringify({ error: 'Lead missing platform_user_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const commMetadata = (comm.metadata as Record<string, unknown> | null) ?? null;
    const routingHint = getRoutingHint(commMetadata);

    let accessToken = '';
    let pageId = '';

    if (channelPlatform === 'messenger') {
      let pageQuery = supabase
        .from('facebook_pages')
        .select('page_id, access_token')
        .eq('organization_id', lead.organization_id)
        .eq('is_enabled', true);

      if (routingHint) {
        pageQuery = pageQuery.eq('page_id', routingHint);
      }

      const { data: pages } = await pageQuery.limit(routingHint ? 1 : 2);
      if (!pages || pages.length === 0) {
        return new Response(JSON.stringify({ error: 'No enabled Facebook page found for this conversation' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (!routingHint && pages.length > 1) {
        return new Response(JSON.stringify({ error: 'Multiple Facebook pages are enabled for this organization and this failed message has no routing context' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      pageId = pages[0].page_id;
      accessToken = await decryptTokenIfNeeded(pages[0].access_token);
    } else {
      const storedPlatform = channelPlatform === 'messenger' ? 'facebook' : channelPlatform;
      const { data: configs } = await supabase
        .from('social_platforms')
        .select('credentials')
        .eq('organization_id', lead.organization_id)
        .eq('platform', storedPlatform)
        .eq('is_enabled', true)
        .limit(20);

      if (!configs || configs.length === 0) {
        return new Response(JSON.stringify({ error: 'No platform credentials' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const matchedConfig = configs.find((config) => {
        const credentials = (config.credentials ?? {}) as Record<string, unknown>;
        if (!routingHint) return false;

        return [
          credentials.page_id,
          credentials.business_account_id,
          credentials.instagram_account_id,
          credentials.instagram_business_account_id,
          credentials.phone_number_id,
          credentials.waba_id,
        ].some((value) => value === routingHint);
      });

      if (!matchedConfig && configs.length > 1) {
        return new Response(JSON.stringify({ error: `Multiple ${storedPlatform} accounts are enabled for this organization and this failed message has no routing context` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const creds = ((matchedConfig || configs[0]).credentials ?? {}) as Record<string, string>;
      if (!creds.access_token) {
        return new Response(JSON.stringify({ error: 'No platform credentials' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      accessToken = await decryptTokenIfNeeded(creds.access_token);
      pageId = channelPlatform === 'whatsapp'
        ? (routingHint || creds.phone_number_id || creds.page_id || '')
        : (routingHint || creds.instagram_account_id || creds.page_id || '');
    }

    if (!accessToken || !pageId) {
      return new Response(JSON.stringify({ error: 'Resolved platform credentials are incomplete' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Attempt to send via appropriate platform API
    try {
      let response: Response;
      let apiUrl: string;
      let apiBody: object;

      if (channelPlatform === 'whatsapp') {
        // WhatsApp Cloud API
        const phoneNumberId = creds.phone_number_id || pageId;
        apiUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
        apiBody = {
          messaging_product: 'whatsapp',
          to: recipientId,
          type: 'text',
          text: { body: comm.content }
        };
      } else if (channelPlatform === 'instagram') {
        // Instagram Graph API
        apiUrl = `https://graph.facebook.com/v18.0/${pageId}/messages`;
        apiBody = {
          recipient: { id: recipientId },
          message: { text: comm.content }
        };
      } else {
        // Default: Messenger
        apiUrl = `https://graph.facebook.com/v18.0/${pageId}/messages`;
        apiBody = {
          recipient: { id: recipientId },
          messaging_type: 'RESPONSE',
          message: { text: comm.content }
        };
      }

      response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(apiBody)
      });

      const text = await response.text();
      if (!response.ok) {
        console.error(`Retry send failed for ${channelPlatform}:`, response.status, text);
        // Update metadata with retry attempt info
        await supabase.from('communications').update({ 
          metadata: { 
            ...(comm.metadata || {}), 
            last_retry_at: new Date().toISOString(),
            retry_error: text.slice(0, 500)
          } 
        }).eq('id', commId);
        return new Response(JSON.stringify({ success: false, error: 'send failed', details: text }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let responseData = null;
      try { responseData = JSON.parse(text); } catch { responseData = null; }

      const messageId = responseData?.message_id || responseData?.messages?.[0]?.id || null;

      // Update communication status
      await supabase.from('communications').update({ status: 'sent', external_id: messageId || null, updated_at: new Date().toISOString(), metadata: { ...(comm.metadata || {}), last_retry_at: new Date().toISOString(), ai_send_status: 'sent' } }).eq('id', commId);

      // Optionally record a notification
      await supabase.from('notification_history').insert({ user_id: null, organization_id: lead.organization_id, type: 'ai_retry', title: 'AI message retried', message: `AI reply retried for lead ${lead.id}`, related_id: lead.id, channel: 'system' });

      await logger.logRequest({ responseStatus: 200, responseTimeMs: Date.now() - start });
      return new Response(JSON.stringify({ success: true, message_id: messageId }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (err) {
      console.error('Retry exception:', err);
      return new Response(JSON.stringify({ success: false, error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

  } catch (err) {
    console.error('Retry-message fatal:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
