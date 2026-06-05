import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyPreparedAIResponseActions, prepareAIResponseForDelivery } from "../_helpers/ai-actions.ts";
import type { AgentType } from "./ai-utils.ts";

type SupabaseDB = SupabaseClient<any>;

export async function finalizeAgentResponse(
  supabase: SupabaseDB,
  options: {
    rawResponse: string;
    organizationId: string;
    leadId?: string | null;
    aiAgentType: AgentType;
    agentName: string;
    actor: string;
    inboundPreview?: string;
  }
) {
  const {
    rawResponse,
    organizationId,
    leadId,
    aiAgentType,
    agentName,
    actor,
    inboundPreview,
  } = options;

  let responseText = rawResponse;
  const needsHumanAssistance = responseText.includes('[NEEDS_HUMAN_ASSISTANCE]');

  if (needsHumanAssistance) {
    responseText = responseText.replace('[NEEDS_HUMAN_ASSISTANCE]', '').trim();

    try {
      const { data: orgMembers } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (orgMembers && orgMembers.length > 0) {
        let contactName = aiAgentType === 'cece' ? 'A guest' : aiAgentType === 'may' ? 'A customer' : 'A lead';

        if (leadId) {
          const { data: lead } = await supabase
            .from('leads')
            .select('name')
            .eq('id', leadId)
            .single();

          if (lead?.name) {
            contactName = lead.name;
          }
        }

        await supabase.from('notification_history').insert(
          orgMembers.map((member: { id: string; email: string }) => ({
            user_id: member.id,
            organization_id: organizationId,
            title: `${agentName} needs help!`,
            message: `${contactName} asked a question ${agentName} couldn't answer. Please check and respond.`,
            type: 'ai_escalation',
            related_id: leadId || null,
          }))
        );

        const emailAddresses = orgMembers
          .map((member: { email: string }) => member.email)
          .filter((email: string | null | undefined): email is string => Boolean(email));

        if (emailAddresses.length > 0) {
          try {
            const preview = inboundPreview ? inboundPreview.slice(0, 200) : 'No message content';
            await supabase.functions.invoke('send-email', {
              body: {
                to: emailAddresses,
                subject: `${agentName} needs help with a conversation`,
                html: `
                  <h2>${agentName} couldn't answer a question</h2>
                  <p><strong>Question:</strong> ${preview}${inboundPreview && inboundPreview.length > 200 ? '...' : ''}</p>
                  <p>Please log in to review and respond.</p>
                `,
              },
            });
          } catch (emailError) {
            console.error(`[${actor}] Failed to send email notifications:`, emailError);
          }
        }
      }
    } catch (notificationError) {
      console.error(`[${actor}] Failed to send escalation notifications:`, notificationError);
    }
  }

  const { actions, cleanText } = prepareAIResponseForDelivery(responseText);

  if (leadId) {
    try {
      await applyPreparedAIResponseActions(supabase, leadId, actions, actor);
    } catch (actionError) {
      console.error(`[${actor}] Failed to apply AI actions:`, actionError);
    }
  }

  return {
    cleanText,
    actions,
    needsHumanAssistance,
  };
}