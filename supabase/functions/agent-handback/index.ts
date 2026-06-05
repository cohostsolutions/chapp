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

    // Get the authenticated user from JWT
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const agentId = user.id;
    const { leadId, conversationId } = await req.json();

    console.log('Agent handback request:', { leadId, agentId, conversationId });

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

    // Get organization's AI agent type and custom messages
    const { data: orgData } = await supabase
      .from('organizations')
      .select('ai_agent_type, name, ai_handback_message')
      .eq('id', profile.organization_id)
      .single();

    const aiAgentType = orgData?.ai_agent_type || 'jay';
    const agentNames: Record<string, string> = {
      jay: 'Jay',
      may: 'May',
      cece: 'Cece'
    };
    const aiName = agentNames[aiAgentType] || 'our AI assistant';

    // Use custom handback message or default, replacing {agent_name} placeholder
    const defaultHandbackMessage = `${aiName} is back to assist you! Feel free to continue your conversation.`;
    const handbackMessage = orgData?.ai_handback_message 
      ? orgData.ai_handback_message.replace(/{agent_name}/g, aiName)
      : defaultHandbackMessage;
    
    // Get the conversation's platform/channel for the handback message
    let messageChannel = 'messenger'; // default
    if (conversationId) {
      const { data: convData } = await supabase
        .from('ai_conversations')
        .select('platform')
        .eq('id', conversationId)
        .single();
      if (convData?.platform) {
        messageChannel = convData.platform;
      }
    }

    // Save the handback message to communications (single source of truth)
    await supabase.from('communications').insert({
      organization_id: profile.organization_id,
      lead_id: leadId,
      channel: messageChannel,
      direction: 'outbound',
      content: handbackMessage,
      status: 'sent',
      metadata: { 
        type: 'handback', 
        triggered_by: agentId,
        is_ai_response: true
      }
    });

    // Update lead: set is_ai_managed back to true and clear agent assignment
    // Note: qualification_status is not changed - it retains its current value
    // Valid statuses are: unqualified, qualifying, qualified, assigned
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        is_ai_managed: true,
        assigned_agent_id: null,
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
          type: 'agent_handback',
          title: `${lead.name} returned to AI`,
          message: `The conversation with ${lead.name} has been handed back to ${aiName}. AI responses are resumed.`,
          related_id: leadId,
        }));

        await supabase.from('notification_history').insert(notifications);
      }
    } catch (notifError) {
      console.error('Failed to create notifications:', notifError);
      // Don't fail the main operation
    }

    console.log('Agent handback successful:', { leadId, agentId, aiName });

    return new Response(
      JSON.stringify({
        success: true,
        handbackMessage,
        lead_id: leadId,
        ai_agent: aiName
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in agent-handback function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
