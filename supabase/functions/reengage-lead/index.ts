import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { verifyAuth, enforceOrganizationAccess, verifyResourceOwnership, createAuthErrorResponse } from "../_shared/auth-guard.ts";
import { logAIError } from "../_shared/ai-errors.ts";
import { type AgentType, getAgentTemperature } from "../_shared/ai-utils.ts";
import { buildAgentSystemPrompt, getAgentMetadata } from "../_shared/agent-runtime.ts";
import { finalizeAgentResponse } from "../_shared/agent-delivery.ts";
import { initVault, vaultDecrypt } from "../_shared/vault.ts";
import { callGeminiAPI, convertToGeminiFormat, type GeminiCallOptions } from "../_shared/google-gemini.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')!;

// Message history limit for context
const MESSAGE_HISTORY_LIMIT = 30;

interface ReengageRequest {
  leadId: string;
  organizationId: string;
  forceContextualResponse?: boolean; // If true, generate response based on last user message
}

serve(async (req: Request) => {
  const corsHeaders = createCorsHeaders(req);
  
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Initialize vault for token decryption
    await initVault(supabase);
    
    const authHeader = req.headers.get('Authorization');

    // Verify authentication
    const authContext = await verifyAuth(authHeader, supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, supabaseServiceKey);
    if (!authContext) {
      return createAuthErrorResponse('Unauthorized', corsHeaders);
    }

    const { leadId, organizationId, forceContextualResponse }: ReengageRequest = await req.json();

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

    console.log(`Re-engaging lead ${leadId} for org ${authorizedOrgId}, contextual: ${forceContextualResponse ?? 'auto'}`);

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, name, phone, source, organization_id, platform_user_id')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      console.error('Lead not found:', leadError);
      return new Response(JSON.stringify({ error: 'Lead not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify lead belongs to authorized org
    try {
      verifyResourceOwnership(authContext, lead.organization_id, authorizedOrgId);
    } catch (error) {
      return createAuthErrorResponse(error as Error, corsHeaders);
    }

    // Get the oldest active conversation for this lead
    const { data: conversation, error: convError } = await supabase
      .from('ai_conversations')
      .select('id, platform, external_id')
      .eq('lead_id', leadId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (convError || !conversation) {
      console.error('No active conversation found:', convError);
      return new Response(JSON.stringify({ error: 'No active conversation found for this lead' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get organization settings
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('ai_agent_type, name, allowed_languages, language_lock_enabled, sales_process_config')
      .eq('id', authorizedOrgId)
      .single();

    if (orgError || !org) {
      console.error('Organization not found:', orgError);
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get platform credentials
    const platformType = conversation.platform === 'messenger' ? 'facebook' : conversation.platform;
    const { data: platformConfig, error: configError } = await supabase
      .from('social_platforms')
      .select('credentials')
      .eq('organization_id', authorizedOrgId)
      .eq('platform', platformType)
      .eq('is_enabled', true)
      .limit(1)
      .single();

    if (configError || !platformConfig) {
      console.error('Platform not configured:', configError);
      return new Response(JSON.stringify({ 
        error: `${conversation.platform} is not configured for this organization` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const credentials = platformConfig.credentials as { access_token: string; page_id: string };
    let accessToken = credentials.access_token;
    const pageId = credentials.page_id;

    // Decrypt token if encrypted
    if (accessToken?.startsWith('vault:')) {
      accessToken = await vaultDecrypt(supabase, accessToken);
    }

    if (!accessToken || !pageId) {
      return new Response(JSON.stringify({ 
        error: 'Platform credentials incomplete' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch conversation history from communications table
    const { data: messages } = await supabase
      .from('communications')
      .select('content, direction, role, created_at')
      .eq('lead_id', leadId)
      .eq('channel', conversation.platform === 'messenger' ? 'messenger' : conversation.platform)
      .order('created_at', { ascending: false })
      .limit(MESSAGE_HISTORY_LIMIT);

    const conversationHistory = (messages || [])
      .reverse()
      .filter(m => m.content)
      .map(m => ({
        role: m.role === 'user' || m.direction === 'inbound' ? 'user' : 'assistant',
        content: m.content
      }));

    // Determine if we need contextual response or generic re-engagement
    const lastMessage = conversationHistory[conversationHistory.length - 1];
    const needsContextualResponse = forceContextualResponse || (lastMessage?.role === 'user');
    
    console.log(`Last message role: ${lastMessage?.role}, generating ${needsContextualResponse ? 'contextual' : 'generic'} response`);

    const agentType = (org.ai_agent_type || 'cece') as AgentType;
  const agentMeta = getAgentMetadata(agentType);
  const agentName = agentMeta.name;

    let responseMessage: string;

    if (needsContextualResponse && conversationHistory.length > 0) {
      // Generate contextual AI response using full conversation history
      console.log(`Generating contextual response with ${conversationHistory.length} history messages`);

      const systemPrompt = await buildAgentSystemPrompt(supabase, {
        organizationId: authorizedOrgId,
        aiAgentType: agentType,
        orgName: org.name,
        allowedLanguages: org.allowed_languages || ['en'],
        languageLockEnabled: org.language_lock_enabled ?? true,
        salesProcessConfig: org.sales_process_config || null,
        leadId,
        additionalContext: `
CONTEXT: This is a Facebook Messenger conversation. You are continuing a conversation with ${lead.name}.
The user sent a message but didn't receive a response due to a brief delay. 
DO NOT apologize for delays. Just respond naturally to their last message as if you're continuing the conversation.
`,
      });

      const aiMessages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: lastMessage?.content || '' }
      ];

      const t = getAgentTemperature(agentType);

      try {
        const geminiRequest = convertToGeminiFormat(aiMessages);
        const callOptions: GeminiCallOptions = {
          maxRetries: 2,
          retryDelayMs: 500,
          timeout: 20000,
          trackMetrics: true,
          fallbackResponse: `Hi ${lead.name}! I apologize for the delayed response. I'm ${agentName} from ${org.name}. How can I help you today?`,
        };

        responseMessage = await callGeminiAPI(GOOGLE_API_KEY, {
          ...geminiRequest,
          generationConfig: {
            maxOutputTokens: 800,
            temperature: t,
          },
        }, 'gemini-2.5-flash', callOptions);
      } catch (error) {
        console.error('Gemini API error:', error instanceof Error ? error.message : error);
        logAIError('reengage-lead', error as Error, {
          organizationId: authorizedOrgId,
          userId: authContext.user.id,
          leadId
        });
        // Use fallback message
        responseMessage = `Hi ${lead.name}! I apologize for the delayed response. I'm ${agentName} from ${org.name}. How can I help you today?`;
      }
    } else {
      // Generate generic re-engagement message
      const t = getAgentTemperature(agentType);

      try {
        const genericSystemPrompt = `You are ${agentName}, a friendly AI assistant for ${org.name}. 
Generate a SHORT, warm re-engagement message for a lead named "${lead.name}" who previously messaged but didn't receive a response due to a technical issue.
The message should:
- Be apologetic but not overly so
- Be friendly and inviting
- Ask if they still need assistance
- Be under 50 words
- Match the tone of a ${agentType === 'cece' ? 'hospitality concierge' : agentType === 'jay' ? 'professional sales agent' : 'friendly food service representative'}

Only output the message text, nothing else.`;

        const geminiRequest = convertToGeminiFormat([
          { role: 'user', content: 'Generate a re-engagement message.' }
        ], genericSystemPrompt);

        const callOptions: GeminiCallOptions = {
          maxRetries: 2,
          retryDelayMs: 500,
          timeout: 15000,
          trackMetrics: true,
          fallbackResponse: `Hi ${lead.name}! We're sorry for the delayed response. I'm ${agentName} from ${org.name}. How can I help?`,
        };

        responseMessage = await callGeminiAPI(GOOGLE_API_KEY, {
          ...geminiRequest,
          generationConfig: {
            maxOutputTokens: 150,
            temperature: t,
          },
        }, 'gemini-2.5-flash', callOptions);
      } catch (error) {
        console.error('Gemini API error (generic):', error instanceof Error ? error.message : error);
        logAIError('reengage-lead', error as Error, {
          organizationId: authorizedOrgId,
          userId: authContext.user.id,
          leadId,
          context: 'generic_message'
        });
        // Use fallback
        responseMessage = `Hi ${lead.name}! We're sorry for the delayed response. I'm ${agentName} from ${org.name}. How can I help?`;
      }
    }

    const finalizedResponse = await finalizeAgentResponse(supabase, {
      rawResponse: responseMessage,
      organizationId: authorizedOrgId,
      leadId,
      aiAgentType: agentType,
      agentName,
      actor: 'reengage-lead',
      inboundPreview: lastMessage?.content || undefined,
    });

    responseMessage = finalizedResponse.cleanText;

    console.log(`Generated response: ${responseMessage.slice(0, 100)}...`);

    // Send message via platform API
    let apiUrl: string;
    let body: Record<string, unknown>;
    const recipientId = conversation.external_id || lead.platform_user_id;

    if (!recipientId) {
      return new Response(JSON.stringify({ error: 'No recipient ID found for this lead' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (conversation.platform === 'messenger' || conversation.platform === 'instagram') {
      apiUrl = `https://graph.facebook.com/v18.0/${pageId}/messages`;
      // Use RESPONSE type for contextual replies within 24h, MESSAGE_TAG for re-engagement
      body = needsContextualResponse ? {
        recipient: { id: recipientId },
        message: { text: responseMessage },
        messaging_type: 'RESPONSE'
      } : {
        recipient: { id: recipientId },
        message: { text: responseMessage },
        messaging_type: 'MESSAGE_TAG',
        tag: 'ACCOUNT_UPDATE'
      };
    } else if (conversation.platform === 'whatsapp') {
      apiUrl = `https://graph.facebook.com/v18.0/${pageId}/messages`;
      body = {
        messaging_product: 'whatsapp',
        to: recipientId,
        type: 'text',
        text: { body: responseMessage }
      };
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported platform' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Sending to ${apiUrl}:`, JSON.stringify(body));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log(`Platform response (${response.status}):`, responseText);

    if (!response.ok) {
      let errorMessage = `Failed to send ${conversation.platform} message`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch (_error) {
        // Parsing failed, use default error message
      }
      
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let messageId;
    try {
      const responseData = JSON.parse(responseText);
      messageId = responseData.message_id || responseData.messages?.[0]?.id;
    } catch (_error) {
      // Parsing failed, messageId remains undefined
    }

    // Save the AI message to communications table
    const { error: msgError } = await supabase
      .from('communications')
      .insert({
        organization_id: lead.organization_id,
        lead_id: leadId,
        channel: conversation.platform === 'messenger' ? 'messenger' : conversation.platform === 'instagram' ? 'instagram' : 'whatsapp',
        direction: 'outbound',
        role: 'assistant',
        content: responseMessage,
        external_id: messageId,
        status: 'sent',
        metadata: { 
          type: needsContextualResponse ? 'contextual_response' : 'reengagement', 
          triggered_by: authContext.user.id, 
          conversation_id: conversation.id,
          is_ai_response: true,
          ai_agent_type: agentType,
          needs_human_assistance: finalizedResponse.needsHumanAssistance,
        }
      });

    if (msgError) {
      console.error('Failed to save AI message:', msgError);
    }

    // Update lead's last_ai_response_at
    const { error: updateError } = await supabase
      .from('leads')
      .update({ last_ai_response_at: new Date().toISOString() })
      .eq('id', leadId);

    if (updateError) {
      console.error('Failed to update lead:', updateError);
    }

    console.log(`Successfully re-engaged lead ${leadId} with ${needsContextualResponse ? 'contextual' : 'generic'} response`);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId,
      message: responseMessage,
      leadName: lead.name,
      responseType: needsContextualResponse ? 'contextual' : 'generic'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error re-engaging lead:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
