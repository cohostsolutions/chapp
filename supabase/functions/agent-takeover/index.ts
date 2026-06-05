import { serve } from "std/http/server";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    // Get the authenticated user from JWT - this is the source of truth for identity
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // The authenticated user IS the agent - ignore any agentId from request body
    const agentId = user.id;
    const { leadId, conversationId } = await req.json();

    console.log('Agent takeover request:', { leadId, agentId, conversationId });

    if (!leadId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: leadId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', agentId)
      .single();

    if (profileError || !profile?.organization_id) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found or no organization assigned' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get lead data
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      console.error('Lead not found:', leadError);
      return new Response(
        JSON.stringify({ error: 'Lead not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the lead belongs to the agent's organization
    if (lead.organization_id !== profile.organization_id) {
      console.error('Organization mismatch:', { leadOrg: lead.organization_id, agentOrg: profile.organization_id });
      return new Response(
        JSON.stringify({ error: 'Access denied: Lead does not belong to your organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get organization's AI agent type, custom messages, and sales process config
    const { data: orgData } = await supabase
      .from('organizations')
      .select('ai_agent_type, name, agent_takeover_message, sales_process_config')
      .eq('id', profile.organization_id)
      .single();

    const aiAgentType = orgData?.ai_agent_type || 'jay';
    const agentNames: Record<string, string> = {
      jay: 'Jay',
      may: 'May', 
      cece: 'Cece'
    };
    const aiName = agentNames[aiAgentType] || 'our AI assistant';

    // Check if handover messaging is disabled in sales process config
    // deno-lint-ignore no-explicit-any
    const salesProcessConfig = (orgData?.sales_process_config ?? {}) as any;
    const handoverEnabled = salesProcessConfig?.handover?.enabled !== false;
    
    // Use custom takeover message or default
    const handoffMessage = orgData?.agent_takeover_message || 
      `I'll connect you with someone from our team who can better assist you. They'll be in touch shortly!`;
    
    // Only send handoff message if handover messaging is enabled
    if (conversationId && handoverEnabled) {
      // Get the conversation platform
      const { data: conversation } = await supabase
        .from('ai_conversations')
        .select('platform')
        .eq('id', conversationId)
        .single();
        
      const platform = conversation?.platform || 'web';
      const channel = platform === 'messenger' ? 'messenger' : platform === 'instagram' ? 'instagram' : platform === 'whatsapp' ? 'whatsapp' : 'ai_chat';
      
      // Save handoff message directly to communications
      await supabase
        .from('communications')
        .insert({
          organization_id: profile.organization_id,
          lead_id: leadId,
          channel,
          direction: 'outbound',
          role: 'assistant',
          content: handoffMessage,
          status: 'sent',
          metadata: { type: 'handoff', triggered_by: agentId, conversation_id: conversationId }
        });
        
      console.log(`Saved handoff message to communications for lead ${leadId}`);
    } else if (!handoverEnabled) {
      console.log(`Handover messaging disabled for organization ${profile.organization_id}, skipping handoff message`);
    }

    // Update lead: set is_ai_managed to false and assign agent
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        is_ai_managed: false,
        assigned_agent_id: agentId,
        qualification_status: 'assigned',
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId);

    if (updateError) {
      console.error('Failed to update lead:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update lead' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create notification for all client admins and agents in the organization
    try {
      // Get all users in the organization (admins and agents)
      const { data: orgUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('organization_id', profile.organization_id);

      if (orgUsers && orgUsers.length > 0) {
        const notifications = orgUsers.map(u => ({
          user_id: u.id,
          organization_id: profile.organization_id,
          type: 'agent_takeover',
          title: `Agent took over ${lead.name}`,
          message: `An agent has taken control of the conversation with ${lead.name}. AI responses are paused.`,
          related_id: leadId,
        }));

        await supabase.from('notification_history').insert(notifications);
      }
    } catch (notifError) {
      console.error('Failed to create notifications:', notifError);
      // Don't fail the main operation
    }

    console.log('Agent takeover successful:', { leadId, agentId });

    return new Response(
      JSON.stringify({
        success: true,
        handoffMessage,
        lead_id: leadId,
        agent_id: agentId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in agent-takeover function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
