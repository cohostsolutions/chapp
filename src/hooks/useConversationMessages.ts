import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { devLog } from '@/lib/logger';

const MESSAGES_QUERY_KEY = 'messages';

interface CallLog {
  id: string;
  lead_id: string;
  created_at: string;
  duration_seconds: number | null;
  status: string | null;
  notes: string | null;
}

export interface UnifiedMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
  source: 'communications' | 'call';
  channel?: string;
  metadata?: Record<string, unknown> | null;
  timestamp?: string;
  rawTimestamp?: string;
  status?: string;
  callDuration?: number;
  senderName?: string;
  reactions?: Record<string, string[]>;
  externalId?: string;
}

/**
 * Hook for fetching messages for a specific conversation.
 * Reads communications plus call logs for a unified conversation timeline.
 * Includes real-time subscription for live message and call updates.
 */
export function useConversationMessages(conversationId: string | null, leadId?: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [MESSAGES_QUERY_KEY, conversationId, leadId],
    queryFn: async (): Promise<UnifiedMessage[]> => {
      if (!conversationId && !leadId) return [];

      let effectiveLeadId = leadId;
      if (!effectiveLeadId && conversationId) {
        const { data: conv } = await supabase
          .from('ai_conversations')
          .select('lead_id')
          .eq('id', conversationId)
          .single();
        effectiveLeadId = conv?.lead_id;
      }

      if (!effectiveLeadId) return [];

      const { data: communications, error } = await supabase
        .from('communications')
        .select('id, direction, role, content, channel, created_at, status, external_id, metadata')
        .eq('lead_id', effectiveLeadId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const { data: callLogs, error: callLogError } = await supabase
        .from('call_logs')
        .select('id, lead_id, created_at, duration_seconds, status, notes')
        .eq('lead_id', effectiveLeadId)
        .order('created_at', { ascending: true });

      if (callLogError) throw callLogError;

      const communicationMessages = (communications || []).map((comm) => {
        const metadata = comm.metadata as Record<string, unknown> | null;

        let role = comm.role || 'agent';
        if (!comm.role) {
          if (comm.direction === 'inbound') {
            role = 'user';
          } else if (metadata?.is_ai_response) {
            role = 'assistant';
          }
        }

        return {
          id: comm.id,
          role,
          content: comm.content || '',
          created_at: comm.created_at,
          source: 'communications' as const,
          channel: comm.channel,
          metadata,
          timestamp: formatTimestamp(comm.created_at),
          rawTimestamp: comm.created_at,
          status: comm.status || undefined,
          senderName: metadata?.sender_name ? String(metadata.sender_name) : undefined,
          reactions: metadata?.reactions as Record<string, string[]> | undefined,
          externalId: comm.external_id || undefined,
        };
      });

      const callMessages = ((callLogs || []) as CallLog[]).map((call) => {
        const statusLabel = call.status === 'completed'
          ? 'Call completed'
          : call.status === 'missed'
            ? 'Missed call'
            : call.status === 'no-answer'
              ? 'No answer'
              : 'Call';
        const duration = call.duration_seconds
          ? ` (${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')})`
          : '';

        return {
          id: call.id,
          role: 'agent',
          content: `📞 ${statusLabel}${duration}${call.notes ? ` - ${call.notes}` : ''}`,
          created_at: call.created_at,
          source: 'call' as const,
          channel: 'call',
          timestamp: formatTimestamp(call.created_at),
          rawTimestamp: call.created_at,
          callDuration: call.duration_seconds || undefined,
        } satisfies UnifiedMessage;
      });

      return [...communicationMessages, ...callMessages].sort((left, right) => {
        const leftTime = new Date(left.rawTimestamp || left.created_at).getTime();
        const rightTime = new Date(right.rawTimestamp || right.created_at).getTime();
        if (leftTime !== rightTime) {
          return leftTime - rightTime;
        }
        return left.id.localeCompare(right.id);
      });
    },
    enabled: !!(conversationId || leadId),
    staleTime: 10000,
  });

  useEffect(() => {
    if (!(conversationId || leadId)) return;

    let isActive = true;
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      let effectiveLeadId = leadId || null;

      if (!effectiveLeadId && conversationId) {
        const { data: conv } = await supabase
          .from('ai_conversations')
          .select('lead_id')
          .eq('id', conversationId)
          .single();
        effectiveLeadId = conv?.lead_id || null;
      }

      if (!isActive || !effectiveLeadId) return;

      realtimeChannel = supabase
        .channel(`communications-${effectiveLeadId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'communications', filter: `lead_id=eq.${effectiveLeadId}` },
          (payload) => {
            devLog('Communication change:', payload.eventType);
            queryClient.invalidateQueries({ queryKey: [MESSAGES_QUERY_KEY, conversationId, leadId] });
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'call_logs', filter: `lead_id=eq.${effectiveLeadId}` },
          (payload) => {
            devLog('Call log change:', payload.eventType);
            queryClient.invalidateQueries({ queryKey: [MESSAGES_QUERY_KEY, conversationId, leadId] });
          }
        )
        .subscribe();
    };

    setup();

    return () => {
      isActive = false;
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [conversationId, leadId, queryClient]);

  const messages = query.data || [];
  const failedCount = messages.filter((message) => {
    const metadata = message.metadata as Record<string, unknown> | null | undefined;
    return message.status === 'failed' || metadata?.ai_send_status === 'failed' || metadata?.delivery_status === 'failed';
  }).length;

  return {
    messages,
    isLoading: query.isLoading,
    error: query.error,
    failedCount,
    refetch: query.refetch,
  };
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  if (diffDays === 1) {
    return `Yesterday ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }
  if (diffDays < 7) {
    return `${date.toLocaleDateString('en-US', { weekday: 'short' })} ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}