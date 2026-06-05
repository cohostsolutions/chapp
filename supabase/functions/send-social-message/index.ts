import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Type alias for Database - define locally to avoid import issues
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { verifyAuth, enforceOrganizationAccess, createAuthErrorResponse } from "../_shared/auth-guard.ts";
import { logAIError } from "../_shared/ai-errors.ts";
import { initVault, vaultDecrypt } from "../_shared/vault.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SendMessageRequest {
  platform: 'whatsapp' | 'messenger' | 'instagram';
  recipientId: string;
  message: string;
  organizationId: string;
  leadId?: string;
}

type ResolvedRoute = {
  accessToken: string;
  pageId: string;
  metadata: Record<string, string>;
};

function getRoutingHint(metadata: Record<string, unknown> | null, platform: SendMessageRequest['platform']): string | null {
  if (!metadata) return null;

  if (platform === 'whatsapp') {
    const phoneNumberId = metadata.phone_number_id;
    if (typeof phoneNumberId === 'string' && phoneNumberId) return phoneNumberId;
  }

  if (platform === 'instagram') {
    const instagramAccountId = metadata.instagram_account_id;
    if (typeof instagramAccountId === 'string' && instagramAccountId) return instagramAccountId;
  }

  const pageId = metadata.page_id;
  return typeof pageId === 'string' && pageId ? pageId : null;
}

async function decryptTokenIfNeeded(supabase: ReturnType<typeof createClient>, token: string): Promise<string> {
  if (!token.startsWith('vault:')) return token;

  try {
    return await vaultDecrypt(supabase, token);
  } catch (error) {
    console.error('[send-social-message] Failed to decrypt token:', error);
    throw new Error('Stored platform token could not be decrypted. Please reconnect the account.');
  }
}

async function resolveRoute(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  platform: SendMessageRequest['platform'],
  leadId?: string,
): Promise<ResolvedRoute> {
  const routingHint = leadId
    ? await (async () => {
        const { data } = await supabase
          .from('communications')
          .select('metadata')
          .eq('organization_id', organizationId)
          .eq('lead_id', leadId)
          .eq('channel', platform)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return getRoutingHint((data?.metadata as Record<string, unknown> | null) ?? null, platform);
      })()
    : null;

  if (platform === 'messenger') {
    let query = supabase
      .from('facebook_pages')
      .select('page_id, access_token')
      .eq('organization_id', organizationId)
      .eq('is_enabled', true);

    if (routingHint) {
      query = query.eq('page_id', routingHint);
    }

    const { data: pages, error } = await query.limit(routingHint ? 1 : 10);
    if (error) throw error;

    if (!pages || pages.length === 0) {
      throw new Error('Messenger is not configured for this organization. Please connect a Facebook page.');
    }

    if (!routingHint && pages.length > 1) {
      throw new Error('Multiple Facebook pages are connected for this organization. Send a message from an existing conversation to preserve routing context.');
    }

    const page = pages[0];
    const accessToken = await decryptTokenIfNeeded(supabase, page.access_token);

    return {
      accessToken,
      pageId: page.page_id,
      metadata: { page_id: page.page_id },
    };
  }

  const { data: configs, error } = await supabase
    .from('social_platforms')
    .select('id, credentials')
    .eq('organization_id', organizationId)
    .eq('platform', platform)
    .eq('is_enabled', true)
    .limit(20);

  if (error) throw error;
  if (!configs || configs.length === 0) {
    throw new Error(`${platform} is not configured for this organization. Please connect your account in Social Platforms settings.`);
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
    throw new Error(`Multiple ${platform} accounts are connected for this organization. Send a message from an existing conversation to preserve routing context.`);
  }

  const chosenConfig = matchedConfig || configs[0];
  const credentials = (chosenConfig.credentials ?? {}) as Record<string, string>;
  const rawAccessToken = credentials.access_token;
  if (!rawAccessToken) {
    throw new Error('Platform credentials are incomplete. Please reconnect the account.');
  }

  const accessToken = await decryptTokenIfNeeded(supabase, rawAccessToken);
  const pageId =
    (platform === 'whatsapp'
      ? credentials.phone_number_id || credentials.page_id
      : routingHint || credentials.instagram_account_id || credentials.page_id) || '';

  if (!pageId) {
    throw new Error('Platform credentials are missing the sender identifier. Please reconnect the account.');
  }

  return {
    accessToken,
    pageId,
    metadata: {
      page_id: pageId,
      ...(platform === 'whatsapp' ? { phone_number_id: pageId } : {}),
      ...(platform === 'instagram' ? { instagram_account_id: pageId } : {}),
    },
  };
}

function looksLikeImageUrl(urlOrName: string): boolean {
  if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(urlOrName)) return true;
  if (urlOrName.includes('lovable-uploads')) return true;
  return false;
}

function looksLikeDocUrl(urlOrName: string): boolean {
  if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv)(\?|$)/i.test(urlOrName)) return true;
  return false;
}

serve(async (req: Request) => {
  const corsHeaders = createCorsHeaders(req);
  
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const authHeader = req.headers.get('Authorization');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify authentication
    const authContext = await verifyAuth(authHeader, supabaseUrl, supabaseAnonKey, supabaseServiceKey);
    if (!authContext) {
      return createAuthErrorResponse('Unauthorized', corsHeaders);
    }
    
    // Use service role client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    await initVault(supabase);

    const { platform, recipientId, message, organizationId, leadId }: SendMessageRequest = await req.json();

    // Enforce organization access
    let authorizedOrgId: string;
    try {
      authorizedOrgId = enforceOrganizationAccess(authContext, organizationId, {
        requireOrganization: true,
        allowSuperAdminOverride: true,
      });
    } catch (error) {
      return createAuthErrorResponse(error as Error, corsHeaders);
    }

    console.log(`[send-social-message] Starting: platform=${platform}, recipientId=${recipientId}, org=${authorizedOrgId}`);

    let route: ResolvedRoute;
    try {
      route = await resolveRoute(supabase, authorizedOrgId, platform, leadId);
    } catch (error) {
      console.error('[send-social-message] Platform resolution failed:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Could not resolve the connected social account for this message.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { accessToken, pageId } = route;

    // Helper: parse message for attachments with filename metadata
    interface FileAttachment {
      url: string;
      filename: string;
    }

    function parseOutboundContent(raw: string): { text: string; images: FileAttachment[]; files: FileAttachment[] } {
      const images: FileAttachment[] = [];
      const files: FileAttachment[] = [];
      
      // Parse [FILE:url|filename] markers (new format with filename)
      const fileMarkerRegex = /\[FILE:(https?:\/\/[^\]|]+)\|([^\]]+)\]/gi;
      let m: RegExpExecArray | null;
      while ((m = fileMarkerRegex.exec(raw)) !== null) {
        const url = m[1];
        const filename = m[2];
        if (looksLikeImageUrl(filename)) {
          images.push({ url, filename });
        } else {
          files.push({ url, filename });
        }
      }
      
      // Parse [IMAGE:url] markers (legacy format)
      const imageMarkerRegex = /\[IMAGE:\s*(https?:\/\/[^\]\s]+)\s*\]/gi;
      while ((m = imageMarkerRegex.exec(raw)) !== null) {
        const url = m[1];
        // Extract filename from URL for legacy format
        const urlFilename = url.split('/').pop()?.split('?')[0] || 'image.jpg';
        if (!images.some(img => img.url === url)) {
          images.push({ url, filename: urlFilename });
        }
      }
      
      // Parse standalone URLs (legacy fallback)
      const urlRegex = /https?:\/\/[^\s)\]|]+/gi;
      while ((m = urlRegex.exec(raw)) !== null) {
        const url = m[0];
        // Skip if already captured
        if (images.some(img => img.url === url) || files.some(f => f.url === url)) continue;
        
        const urlFilename = url.split('/').pop()?.split('?')[0] || 'file';
        if (looksLikeImageUrl(url) || looksLikeImageUrl(urlFilename)) {
          images.push({ url, filename: urlFilename });
        } else if (looksLikeDocUrl(url) || looksLikeDocUrl(urlFilename) || url.includes('/storage/v1/object/')) {
          files.push({ url, filename: urlFilename });
        }
      }
      
      // Clean text: remove all markers and URLs
      let text = raw
        .replace(fileMarkerRegex, '')
        .replace(imageMarkerRegex, '')
        .trim();
      
      // Remove remaining URLs that were captured
      for (const img of images) {
        text = text.split(img.url).join('');
      }
      for (const f of files) {
        text = text.split(f.url).join('');
      }
      
      // Clean up markdown and formatting
      text = text
        .replace(/#{1,6}\s+/g, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
        
      return { text, images, files };
    }

    // Parse message for text, images and files
    const { text, images, files } = parseOutboundContent(message);

    console.log(`[send-social-message] Parsed content: text=${text.length}chars, images=${images.length}, files=${files.length}`);

    // Determine API URL based on platform
    let apiUrl: string;
    if (platform === 'whatsapp') {
      apiUrl = `https://graph.facebook.com/v18.0/${pageId}/messages`;
    } else {
      // Messenger and Instagram use the same endpoint
      apiUrl = `https://graph.facebook.com/v18.0/${pageId}/messages`;
    }

    // Send helper function
    const sendRequest = async (payload: Record<string, unknown>): Promise<{ ok: boolean; messageId?: string; error?: string }> => {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const responseText = await response.text();
      console.log(`[send-social-message] Platform response: status=${response.status}, body=${responseText.substring(0, 200)}`);
      
      if (!response.ok) {
        let errorMessage = `Failed to send ${platform} message`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error?.message || errorMessage;
        } catch (_error) {
          // Parsing failed, use default error message
        }
        return { ok: false, error: errorMessage };
      }
      
      try {
        const responseData = JSON.parse(responseText);
        return { ok: true, messageId: responseData.message_id || responseData.messages?.[0]?.id };
      } catch {
        return { ok: true };
      }
    };

    let messageId: string | undefined;
    
    // Send text message first (if any)
    if (text) {
      let textPayload: Record<string, unknown>;
      if (platform === 'whatsapp') {
        textPayload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientId,
          type: 'text',
          text: { body: text }
        };
      } else {
        textPayload = {
          recipient: { id: recipientId },
          message: { text }
        };
      }
      
      const textResult = await sendRequest(textPayload);
      if (!textResult.ok) {
        return new Response(JSON.stringify({ error: textResult.error }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      messageId = textResult.messageId;
    }

    let attachmentFailures = 0;

    // Send images as attachments
    for (const img of images) {
      let imagePayload: Record<string, unknown>;
      if (platform === 'whatsapp') {
        imagePayload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientId,
          type: 'image',
          image: { link: img.url }
        };
      } else {
        imagePayload = {
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: 'image',
              payload: { url: img.url, is_reusable: true }
            }
          }
        };
      }
      
      const imageResult = await sendRequest(imagePayload);
      if (!imageResult.ok) {
        console.warn(`[send-social-message] Failed to send image ${img.filename}: ${imageResult.error}`);
        attachmentFailures += 1;
      } else if (!messageId) {
        messageId = imageResult.messageId;
      }
    }

    // Send files/documents as attachments
    for (const file of files) {
      let filePayload: Record<string, unknown>;
      if (platform === 'whatsapp') {
        // WhatsApp supports documents with filename
        filePayload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientId,
          type: 'document',
          document: { 
            link: file.url,
            filename: file.filename 
          }
        };
      } else {
        // Messenger/Instagram use 'file' type for documents
        filePayload = {
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: 'file',
              payload: { url: file.url, is_reusable: true }
            }
          }
        };
      }
      
      const fileResult = await sendRequest(filePayload);
      if (!fileResult.ok) {
        console.warn(`[send-social-message] Failed to send file ${file.filename}: ${fileResult.error}`);
        attachmentFailures += 1;
      } else if (!messageId) {
        messageId = fileResult.messageId;
      }
    }

    // Get user name for agent attribution
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', authContext.user.id)
      .single();
    
    const senderName = profile?.full_name || profile?.email || 'Agent';

    // Log communication in database - role is 'agent' for human-sent messages
    const { error: logError } = await supabase
      .from('communications')
      .insert({
        organization_id: authorizedOrgId,
        lead_id: leadId || null,
        channel: platform,
        direction: 'outbound',
        role: 'agent',
        content: message,
        status: attachmentFailures > 0 ? 'partial' : 'sent',
        external_id: messageId,
        user_id: authContext.user.id,
        metadata: {
          sender_name: senderName,
          sent_by_agent: true,
          attachment_failures: attachmentFailures,
          ...route.metadata,
        },
      });

    if (logError) {
      console.error('Failed to log communication:', logError);
      // Don't fail the request, message was sent successfully
    }

    return new Response(JSON.stringify({ 
      success: true, 
      messageId,
      platform,
      attachmentFailures,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error sending social message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
