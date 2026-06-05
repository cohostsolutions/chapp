import { serve } from "std/http/server";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { initVault, vaultDecrypt } from "../_shared/vault.ts";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  const logger = createLogger(req, 'backfill-facebook-messages');
  const startTime = Date.now();
  
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) {
    await logger.logRequest({ responseStatus: 200, responseTimeMs: Date.now() - startTime });
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

    // Initialize vault for decrypting tokens
    const vaultEnabled = await initVault(supabaseAdmin);
    console.log('[Backfill] Vault encryption:', vaultEnabled ? 'enabled' : 'disabled');

    // Verify user is authorized (super_admin or client_admin)
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

    const isSuperAdmin = callerRoles?.some((r) => r.role === "super_admin");
    const isClientAdmin = callerRoles?.some((r) => r.role === "client_admin");

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

    // Get Facebook platform credentials
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

    console.log(`[Backfill] Starting quick sync for page ID: ${pageId}`);

    let messagesRecovered = 0;
    let newLeadsCreated = 0;
    let conversationsProcessed = 0;
    const errors: string[] = [];

    // Calculate cutoff date (14 days ago for extended backfill)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 14);

    // OPTIMIZATION: Batch fetch ALL existing leads for this org by phone (Facebook PSID)
    const { data: existingLeads } = await supabaseAdmin
      .from("leads")
      .select("id, phone")
      .eq("organization_id", organizationId)
      .eq("source", "facebook");

    const leadsByPhone = new Map<string, string>();
    for (const lead of existingLeads || []) {
      if (lead.phone) {
        leadsByPhone.set(lead.phone, lead.id);
      }
    }
    console.log(`[Backfill] Loaded ${leadsByPhone.size} existing Facebook leads`);

    // OPTIMIZATION: Batch fetch existing message external_ids to avoid duplicates
    const { data: existingMessages } = await supabaseAdmin
      .from("communications")
      .select("external_id")
      .eq("organization_id", organizationId)
      .eq("channel", "messenger")
      .not("external_id", "is", null);

    const existingMessageIds = new Set<string>();
    for (const msg of existingMessages || []) {
      if (msg.external_id) {
        existingMessageIds.add(msg.external_id);
      }
    }
    console.log(`[Backfill] Loaded ${existingMessageIds.size} existing message IDs`);

    // Fetch recent conversations from Facebook (limit to 25 for speed)
    const conversationsUrl = `https://graph.facebook.com/v17.0/${pageId}/conversations?fields=participants,messages.limit(25){message,from,created_time,id}&limit=25&access_token=${accessToken}`;
    
    console.log('[Backfill] Fetching conversations from Facebook...');
    const convRes = await fetch(conversationsUrl);
    const convJson = await convRes.json();

    if (convJson.error) {
      console.error('[Backfill] Facebook API error:', convJson.error);
      return new Response(JSON.stringify({ 
        error: `Facebook API error: ${convJson.error.message}`,
        error_code: convJson.error.code
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const conversations = convJson.data || [];
    console.log(`[Backfill] Found ${conversations.length} conversations`);

    // Collect all new leads and messages to batch insert
    const newLeadsToInsert: Array<{
      name: string;
      phone: string;
      organization_id: string;
      source: string;
      status: string;
      is_ai_managed: boolean;
    }> = [];
    
    const messagesToInsert: Array<{
      lead_id: string;
      organization_id: string;
      channel: string;
      direction: string;
      role: string;
      content: string;
      external_id: string;
      status: string;
      created_at: string;
      metadata: Record<string, unknown>;
    }> = [];

    // First pass: identify new leads needed
    const newLeadPhones: string[] = [];
    for (const conv of conversations) {
      const participants = conv.participants?.data || [];
      const userParticipant = participants.find((p: { id: string }) => p.id !== pageId);
      if (!userParticipant) continue;
      
      const senderId = userParticipant.id;
      if (!leadsByPhone.has(senderId) && !newLeadPhones.includes(senderId)) {
        newLeadPhones.push(senderId);
        newLeadsToInsert.push({
          name: userParticipant.name || 'Unknown Contact',
          phone: senderId,
          organization_id: organizationId,
          source: "Facebook", // Match webhook capitalization
          status: "new",
          is_ai_managed: true,
        });
      }
    }

    // Batch insert new leads
    if (newLeadsToInsert.length > 0) {
      console.log(`[Backfill] Creating ${newLeadsToInsert.length} new leads...`);
      const { data: insertedLeads, error: leadError } = await supabaseAdmin
        .from("leads")
        .insert(newLeadsToInsert)
        .select("id, phone");

      if (leadError) {
        console.error('[Backfill] Lead batch insert error:', leadError);
        errors.push(`Lead batch insert failed: ${leadError.message}`);
      } else {
        for (const lead of insertedLeads || []) {
          if (lead.phone) {
            leadsByPhone.set(lead.phone, lead.id);
          }
        }
        newLeadsCreated = insertedLeads?.length || 0;
        console.log(`[Backfill] Created ${newLeadsCreated} new leads`);

        // Batch insert AI conversations for new leads
        const aiConversations = (insertedLeads || []).map(lead => ({
          lead_id: lead.id,
          organization_id: organizationId,
          platform: "messenger",
          external_id: lead.phone,
          status: "active",
          started_at: new Date().toISOString(),
        }));

        if (aiConversations.length > 0) {
          await supabaseAdmin.from("ai_conversations").insert(aiConversations);
        }
      }
    }

    // Second pass: collect all new messages
    for (const conv of conversations) {
      conversationsProcessed++;
      
      const participants = conv.participants?.data || [];
      const userParticipant = participants.find((p: { id: string }) => p.id !== pageId);
      if (!userParticipant) continue;
      
      const senderId = userParticipant.id;
      const leadId = leadsByPhone.get(senderId);
      if (!leadId) continue;

      const messages = conv.messages?.data || [];
      
      for (const msg of messages) {
        // Skip if we already have this message
        if (existingMessageIds.has(msg.id)) continue;
        
        const messageTime = new Date(msg.created_time);
        // Skip messages older than 14 days
        if (messageTime < cutoffDate) continue;

        const fromId = msg.from?.id;
        const isFromPage = fromId === pageId;
        const direction = isFromPage ? "outbound" : "inbound";
        const role = isFromPage ? "assistant" : "user";

        messagesToInsert.push({
          lead_id: leadId,
          organization_id: organizationId,
          channel: "messenger",
          direction: direction,
          role: role,
          content: msg.message || '',
          external_id: msg.id,
          status: isFromPage ? "delivered" : "received",
          created_at: messageTime.toISOString(),
          metadata: {
            backfilled: true,
            backfill_time: new Date().toISOString(),
            from_id: fromId,
            sender_id: isFromPage ? undefined : fromId,
            is_ai_response: isFromPage
          }
        });
        
        // Track to avoid duplicates in this batch
        existingMessageIds.add(msg.id);
      }
    }

    // Batch insert all new messages
    if (messagesToInsert.length > 0) {
      console.log(`[Backfill] Inserting ${messagesToInsert.length} new messages...`);
      const { error: msgError } = await supabaseAdmin
        .from("communications")
        .insert(messagesToInsert);

      if (msgError) {
        console.error('[Backfill] Message batch insert error:', msgError);
        errors.push(`Message batch insert failed: ${msgError.message}`);
      } else {
        messagesRecovered = messagesToInsert.length;
      }
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`[Backfill] Complete in ${elapsedMs}ms! Conversations: ${conversationsProcessed}, New leads: ${newLeadsCreated}, Messages: ${messagesRecovered}`);

    await logger.logRequest({ 
      responseStatus: 200, 
      responseTimeMs: elapsedMs
    });

    return new Response(JSON.stringify({
      success: true,
      conversations_processed: conversationsProcessed,
      new_leads_created: newLeadsCreated,
      messages_recovered: messagesRecovered,
      elapsed_ms: elapsedMs,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('[Backfill] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logger.logRequest({ 
      responseStatus: 500, 
      responseTimeMs: Date.now() - startTime,
      errorMessage
    });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
