/// <reference path="../deno.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { initVault, vaultDecrypt } from "../_shared/vault.ts";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import {
  type AgentType,
  getAgentTemperature,
} from "../_shared/ai-utils.ts";
import { buildAgentSystemPrompt, getAgentMetadata } from "../_shared/agent-runtime.ts";
import { finalizeAgentResponse } from "../_shared/agent-delivery.ts";
import { claimProcessingLock, releaseProcessingLock } from '../_helpers/locks.ts';
import { callGeminiAPI, convertToGeminiFormat, type GeminiCallOptions } from "../_shared/google-gemini.ts";

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')!;

// Message history limit - enough context for complex conversations
const MESSAGE_HISTORY_LIMIT = 50;

serve(async (req: Request) => {
  const corsHeaders = createCorsHeaders(req);
  const logger = createLogger(req, 'process-pending-messages');
  const startTime = Date.now();
  
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) {
    return preflightResponse;
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize vault
    const vaultEnabled = await initVault(supabaseAdmin);

    // Verify user is authorized
    const { data: { user: callingUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !callingUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id);

    const isSuperAdmin = callerRoles?.some((r: { role: string }) => r.role === "super_admin");
    const isClientAdmin = callerRoles?.some((r: { role: string }) => r.role === "client_admin");

    if (!isSuperAdmin && !isClientAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get caller's organization
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("id", callingUser.id)
      .single();

    const organizationId = callerProfile?.organization_id;
    if (!organizationId) {
      return new Response(JSON.stringify({ error: "User has no organization" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get organization settings and platform credentials
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, name, ai_agent_type, allowed_languages, language_lock_enabled, sales_process_config")
      .eq("id", organizationId)
      .single();

    const { data: platform } = await supabaseAdmin
      .from("social_platforms")
      .select("credentials")
      .eq("organization_id", organizationId)
      .eq("platform", "facebook")
      .eq("is_enabled", true)
      .single();

    if (!platform?.credentials) {
      return new Response(JSON.stringify({ error: "No Facebook platform connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const credentials = platform.credentials as Record<string, string>;
    const pageId = credentials.page_id;
    let accessToken = credentials.access_token;

    // Decrypt token if encrypted
    if (accessToken?.startsWith('vault:')) {
      accessToken = await vaultDecrypt(supabaseAdmin, accessToken);
    }

    console.log('[ProcessPending] Finding leads with unanswered messages...');

    // Optional request body (allows running a bigger catch-up pass when needed)
    const body = req.method === 'POST'
      ? await req.json().catch(() => ({}))
      : {};

    const leadLimitRaw = (body as { limit?: unknown }).limit;
    const leadLimit = typeof leadLimitRaw === 'number'
      ? Math.min(Math.max(Math.floor(leadLimitRaw), 1), 500)
      : 25;

    // Optional: force response for a specific lead (even if last message is not from user)
    const forceLeadId = (body as { force_lead_id?: string }).force_lead_id;
    const forceResponse = (body as { force_response?: boolean }).force_response === true;

    // Find AI-managed leads and inspect their latest Messenger thread state.
    // A lead is "pending" if there are inbound messages after the last outbound AI response.
    let pendingLeadsQuery = supabaseAdmin
      .from("leads")
      .select(`
        id, name, platform_user_id,
        communications!inner (
          id, content, direction, role, created_at, metadata, channel
        )
      `)
      .eq("organization_id", organizationId)
      .eq("is_ai_managed", true);

    // If forcing a specific lead, filter to just that lead
    if (forceLeadId) {
      pendingLeadsQuery = pendingLeadsQuery.eq("id", forceLeadId);
    } else {
      pendingLeadsQuery = pendingLeadsQuery
        .order("updated_at", { ascending: false })
        .limit(leadLimit);
    }

    const { data: pendingLeads } = await pendingLeadsQuery;

    let messagesProcessed = 0;
    let aiResponsesSent = 0;
    const errors: string[] = [];

    for (const lead of pendingLeads || []) {
      let lockAcquired = false;
      try {
        // Acquire DB-backed lock to avoid duplicate processing across workers
        try {
          lockAcquired = await claimProcessingLock(supabaseAdmin, String(lead.id), organizationId, 'messenger');
        } catch (err) {
          console.warn('[ProcessPending] claimProcessingLock error:', err);
          lockAcquired = false;
        }

        if (!lockAcquired) {
          console.log(`[ProcessPending] Skipping lead ${lead.id} - another worker is processing it.`);
          continue;
        }
        // Focus on Messenger messages for catch-up
        const messages = (lead.communications || [])
          .filter((m: { channel?: string }) => m.channel === 'messenger')
          .sort(
            (a: { created_at: string; [key: string]: unknown }, b: { created_at: string; [key: string]: unknown }) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

        // Get the most recent message
        const lastMessage = messages[0];
        if (!lastMessage) continue;

        // Only respond when the latest message is from the user (inbound)
        // OR if force_response is enabled for this specific lead
        const isFromUser = lastMessage.direction === 'inbound' || lastMessage.role === 'user';
        const shouldProcess = isFromUser || (forceResponse && forceLeadId === lead.id);
        
        if (!shouldProcess) {
          console.log(`[ProcessPending] Lead ${lead.name}: Last message is not from user (direction=${lastMessage.direction}, role=${lastMessage.role})`);
          continue;
        }

        // For forced responses, use the last user message instead of the last message
        let targetMessage = lastMessage;
        if (forceResponse && !isFromUser) {
          const lastUserMessage = messages.find((m: { direction?: string; role?: string; [key: string]: unknown }) => 
            m.direction === 'inbound' || m.role === 'user'
          );
          if (lastUserMessage) {
            targetMessage = lastUserMessage;
            console.log(`[ProcessPending] Lead ${lead.name}: Force mode - using last user message: "${(targetMessage.content as string)?.slice(0, 50)}..."`);
          }
        }

        const lastMessageText = typeof targetMessage.content === 'string' ? targetMessage.content : '';
        if (!lastMessageText.trim()) {
          console.log(`[ProcessPending] Lead ${lead.name}: Target message has no text content; skipping`);
          continue;
        }

        // For forced responses, skip the "already has AI response" check
        if (!forceResponse) {
          // Check if there's already an AI response after this message
          const lastMessageTime = new Date(lastMessage.created_at);
          const hasAIResponse = messages.some((m: { direction?: string; role?: string; created_at: string; [key: string]: unknown }) =>
            (m.direction === 'outbound' || m.role === 'assistant') &&
            new Date(m.created_at) > lastMessageTime
          );

          if (hasAIResponse) {
            console.log(`[ProcessPending] Lead ${lead.name}: Already has AI response`);
            continue;
          }
        } else {
          console.log(`[ProcessPending] Lead ${lead.name}: Force response enabled - skipping AI response check`);
        }

        console.log(`[ProcessPending] Processing lead ${lead.name} - pending message: "${lastMessageText.slice(0, 50)}..."`);
        messagesProcessed++;

        // Build conversation history (last 50 messages for full context)
        const conversationHistory = messages
          .slice(0, MESSAGE_HISTORY_LIMIT)
          .reverse()
          .filter((m: { content?: string; [key: string]: unknown }) => typeof m.content === 'string' && m.content.trim().length > 0)
          .map((m: { role?: string; direction?: string; content?: string; [key: string]: unknown }) => ({
            role: m.role === 'user' || m.direction === 'inbound' ? 'user' : 'assistant',
            content: m.content as string
          }));

        // Generate AI response using shared utilities
        const agentType = (org?.ai_agent_type || 'jay') as AgentType;

        const rawAiResponse = await generateAIResponse(
          supabaseAdmin,
          agentType,
          lastMessageText,
          conversationHistory.slice(0, -1), // Exclude the last message as it's the current one
          {
            organizationId,
            orgName: org?.name || '',
            allowedLanguages: org?.allowed_languages || ['en'],
            languageLockEnabled: org?.language_lock_enabled ?? true,
            salesProcessConfig: org?.sales_process_config || null,
            leadId: String(lead.id),
          }
        );

        if (!rawAiResponse) {
          console.error(`[ProcessPending] No AI response generated for lead ${lead.name}`);
          continue;
        }

        const agentMeta = getAgentMetadata(agentType);
        const finalizedResponse = await finalizeAgentResponse(supabaseAdmin, {
          rawResponse: rawAiResponse,
          organizationId,
          leadId: String(lead.id),
          aiAgentType: agentType,
          agentName: agentMeta.name,
          actor: 'process-pending-messages',
          inboundPreview: lastMessageText,
        });

        const recipientId = String(lead.platform_user_id || '');
        if (!recipientId) {
          errors.push(`Lead ${lead.name} has no platform_user_id; cannot send Messenger reply`);
          continue;
        }

        // Send response to Facebook Messenger
        const sent = await sendMessengerResponse(pageId, recipientId, finalizedResponse.cleanText, accessToken);

        if (sent) {
          // Save AI response to communications
          await supabaseAdmin.from("communications").insert({
            lead_id: lead.id,
            organization_id: organizationId,
            channel: "messenger",
            direction: "outbound",
            role: "assistant",
            content: finalizedResponse.cleanText,
            status: "sent",
            metadata: {
              is_ai_response: true,
              processed_pending: true,
              process_time: new Date().toISOString(),
              ai_agent_type: agentType,
              needs_human_assistance: finalizedResponse.needsHumanAssistance,
            }
          });

          // Update lead's last_ai_response_at
          await supabaseAdmin
            .from("leads")
            .update({ last_ai_response_at: new Date().toISOString() })
            .eq("id", lead.id);

          aiResponsesSent++;
          console.log(`[ProcessPending] AI response sent to ${lead.name}`);
        } else {
          errors.push(`Failed to send response to ${lead.name}`);
          try {
            await supabaseAdmin.from('communications').insert({
              lead_id: lead.id,
              organization_id: organizationId,
              channel: 'messenger',
              direction: 'outbound',
              role: 'assistant',
              content: finalizedResponse.cleanText,
              status: 'failed',
              metadata: { is_ai_response: true, ai_send_status: 'failed', processed_pending: true, process_time: new Date().toISOString() }
            });

            await supabaseAdmin.from('notification_history').insert({
              user_id: null,
              organization_id: organizationId,
              type: 'ai_failure',
              title: 'AI message failed to send',
              message: `Failed to deliver AI reply for lead ${lead.id} via messenger`,
              related_id: lead.id,
              channel: 'in_app'
            });
          } catch (e) {
            console.error('[ProcessPending] Failed to persist failed message or notify:', e);
          }
        }

        // Small delay between processing leads to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        console.error(`[ProcessPending] Error processing lead ${lead.name}:`, err);
        errors.push(`Error processing ${lead.name}: ${(err as Error).message}`);
      } finally {
        if (lockAcquired) {
          try {
            await releaseProcessingLock(supabaseAdmin, String(lead.id), 'messenger');
          } catch (e) {
            console.warn('[ProcessPending] Error releasing lock during finally:', e);
          }
        }
      }
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`[ProcessPending] Complete in ${elapsedMs}ms! Processed: ${messagesProcessed}, Sent: ${aiResponsesSent}`);

    await logger.logRequest({ 
      responseStatus: 200, 
      responseTimeMs: elapsedMs
    });

    return new Response(JSON.stringify({
      success: true,
      messages_processed: messagesProcessed,
      ai_responses_sent: aiResponsesSent,
      elapsed_ms: elapsedMs,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('[ProcessPending] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logger.logRequest({ 
      responseStatus: 500, 
      responseTimeMs: Date.now() - startTime,
      errorMessage
    });
    
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function generateAIResponse(
  supabase: any,
  agentType: AgentType,
  messageText: string,
  conversationHistory: { role: string; content: string }[],
  options: {
    organizationId: string;
    orgName: string;
    allowedLanguages: string[];
    languageLockEnabled: boolean;
    salesProcessConfig: unknown;
    leadId: string;
  }
): Promise<string | null> {
  if (!GOOGLE_API_KEY) {
    console.error("GOOGLE_API_KEY not set");
    return null;
  }

  const systemPrompt = await buildAgentSystemPrompt(supabase, {
    organizationId: options.organizationId,
    aiAgentType: agentType,
    orgName: options.orgName,
    allowedLanguages: options.allowedLanguages,
    languageLockEnabled: options.languageLockEnabled,
    salesProcessConfig: options.salesProcessConfig as never,
    leadId: options.leadId,
    additionalContext: `
CONTEXT: This is a Facebook Messenger conversation. The user's message was received while you were processing other messages.
Respond naturally as if continuing the conversation in real-time.
`,
  });

  console.log(`[ProcessPending] Generating response with ${conversationHistory.length} history messages`);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: messageText }
  ];

  try {
    const geminiRequest = convertToGeminiFormat(messages);
    const callOptions: GeminiCallOptions = {
      maxRetries: 2,
      retryDelayMs: 500,
      timeout: 20000,
      trackMetrics: true,
      fallbackResponse: "I apologize, I'm having trouble understanding that right now. Could you please rephrase?",
    };

    const response = await callGeminiAPI(GOOGLE_API_KEY, {
      ...geminiRequest,
      generationConfig: {
        maxOutputTokens: 800,
          temperature: getAgentTemperature(agentType),
      },
    }, 'gemini-2.5-flash', callOptions);

    return response || null;
  } catch (error) {
    console.error('Error generating AI response:', error);
    return null;
  }
}

async function sendMessengerResponse(
  pageId: string,
  recipientId: string,
  message: string,
  accessToken: string
): Promise<boolean> {
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${pageId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: 'RESPONSE',
        message: { text: message }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send Messenger response:', response.status, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending Messenger response:', error);
    return false;
  }
}
