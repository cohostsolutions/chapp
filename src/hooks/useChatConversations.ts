import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getConversationPreview } from '@/lib/chatConversationSummary';
import { devLog, devError } from '@/lib/logger';

interface Communication {
  id: string;
  organization_id: string;
  lead_id: string | null;
  channel: string;
  direction: 'inbound' | 'outbound';
  role: string | null;
  content: string | null;
  subject: string | null;
  status: string | null;
  external_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

interface AiConversationRealtimeRecord {
  id: string;
  lead_id: string | null;
  organization_id: string;
  external_id: string | null;
  platform: string | null;
  status: string | null;
}

interface ChatConversationSummaryRow {
  id: string;
  lead_id: string;
  lead_name: string | null;
  phone: string | null;
  email: string | null;
  last_message_content: string | null;
  last_message_at: string;
  last_message_direction: 'inbound' | 'outbound' | null;
  last_message_metadata: Record<string, unknown> | null;
  unread: number;
  channel: string;
  message_count: number;
  failed_message_count: number;
  external_id: string | null;
  linked_booking_id: string | null;
  linked_booking_room_name: string | null;
  linked_booking_check_in: string | null;
  linked_booking_check_out: string | null;
  linked_booking_status: string | null;
  is_ai_managed: boolean | null;
  lead_temperature: string | null;
  conversation_status: string | null;
  platform: string | null;
  started_at: string | null;
}

export interface LinkedBookingInfo {
  id: string;
  room_name: string;
  check_in: string;
  check_out: string;
  status: string;
}

export interface ChatConversation {
  id: string;
  leadId: string | null;
  leadName: string;
  phone: string;
  email: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
  channel: string;
  messages: ChatMessage[];
  messageCount: number;
  failedMessageCount: number;
  externalId?: string;
  lastMessageDirection?: 'inbound' | 'outbound';
  linkedBooking?: LinkedBookingInfo | null;
  isAiManaged?: boolean;
  leadTemperature?: 'hot' | 'warm' | 'cold' | null;
  conversationStatus?: 'active' | 'ended' | 'archived';
  platform?: string;
  startedAt?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'agent';
  content: string;
  timestamp: string;
  channel: string;
  status?: string;
  source?: 'communications' | 'call';
  rawTimestamp?: string;
  callDuration?: number;
  senderName?: string;
  reactions?: Record<string, string[]>;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export interface NewMessageInfo {
  senderName: string;
  content: string;
  channel: string;
  leadId?: string | null;
}

export function useChatConversations(organizationId?: string) {
  const queryClient = useQueryClient();
  const onNewMessageRef = useRef<((info: NewMessageInfo) => void) | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['chat-conversations', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      if (!organizationId) {
        devLog('⚠️ WARNING: useChatConversations called without organizationId');
        return [];
      }

      devLog(`📊 Fetching conversation summaries for organization: ${organizationId}`);

      const { data: rpcRows, error: rpcError } = await supabase.rpc('get_chat_conversation_summaries', {
        p_organization_id: organizationId,
      });

      if (rpcError) throw rpcError;

      return ((rpcRows || []) as ChatConversationSummaryRow[]).map(mapSummaryRowToConversation);
    },
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel('chat-conversations-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'communications',
          filter: `organization_id=eq.${organizationId}`,
        },
        async (payload) => {
          try {
          devLog('New communication received (realtime INSERT):', payload.eventType);
          const comm = payload.new as Communication;

          if (!comm) return;

          const leadId = comm.lead_id;
          if (leadId) {
            queryClient.setQueryData<ChatConversation[]>(
              ['chat-conversations', organizationId],
              (oldData) => {
                if (!oldData) return oldData;

                return oldData.map((conversation) => {
                  if (conversation.leadId !== leadId) return conversation;

                  return {
                    ...conversation,
                    lastMessage: getConversationPreview({
                      content: comm.content,
                      direction: comm.direction,
                      metadata: comm.metadata,
                    }),
                    lastMessageAt: comm.created_at,
                    channel: comm.channel || conversation.channel,
                    lastMessageDirection: comm.direction,
                    messageCount: conversation.messageCount + 1,
                    failedMessageCount: isFailedCommunication(comm)
                      ? conversation.failedMessageCount + 1
                      : conversation.failedMessageCount,
                    unread: comm.direction === 'inbound' && comm.status !== 'read'
                      ? conversation.unread + 1
                      : conversation.unread,
                    externalId: conversation.externalId || extractSenderIdFromMetadata(comm),
                  };
                });
              }
            );
          }

          if (comm.direction === 'inbound') {
            let senderName = 'Unknown Contact';
            if (comm.lead_id) {
              const { data: lead } = await supabase
                .from('leads')
                .select('name')
                .eq('id', comm.lead_id)
                .single();
              if (lead?.name) senderName = lead.name;
            } else {
              const metadata = comm.metadata as Record<string, unknown> | null;
              if (metadata?.sender_name) senderName = String(metadata.sender_name);
              else if (metadata?.from_name) senderName = String(metadata.from_name);
            }

            onNewMessageRef.current?.({
              senderName,
              content: comm.content || '',
              channel: comm.channel,
              leadId,
            });
          }

          if (!leadId) {
            queryClient.invalidateQueries({ queryKey: ['chat-conversations', organizationId] });
            return;
          }

          const existing = queryClient.getQueryData<ChatConversation[]>(['chat-conversations', organizationId]);
          const hasConversation = !!existing?.some((conversation) => conversation.leadId === leadId);
          if (!hasConversation) {
            queryClient.invalidateQueries({ queryKey: ['chat-conversations', organizationId] });
          }
          } catch (err) {
            devLog('Error processing realtime INSERT for chat-conversations:', err);
            queryClient.invalidateQueries({ queryKey: ['chat-conversations', organizationId] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'communications',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          devLog('Communication updated (realtime UPDATE):', payload.eventType);
          const comm = payload.new as Communication;

          if (comm?.lead_id) {
            queryClient.setQueryData<ChatConversation[]>(
              ['chat-conversations', organizationId],
              (oldData) => {
                if (!oldData) return oldData;

                return oldData.map((conversation) => {
                  if (conversation.leadId !== comm.lead_id) return conversation;

                  return {
                    ...conversation,
                    failedMessageCount: Math.max(
                      0,
                      conversation.failedMessageCount + getFailedCountDelta(payload.old as Communication, comm)
                    ),
                  };
                });
              }
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_conversations',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          devLog('AI conversation change received (realtime):', payload.eventType);

          const record = (payload.eventType === 'DELETE' ? payload.old : payload.new) as AiConversationRealtimeRecord | null;
          if (!record?.lead_id) {
            queryClient.invalidateQueries({ queryKey: ['chat-conversations', organizationId] });
            return;
          }

          if (payload.eventType === 'DELETE') {
            queryClient.invalidateQueries({ queryKey: ['chat-conversations', organizationId] });
            return;
          }

          let matchedConversation = false;

          queryClient.setQueryData<ChatConversation[]>(
            ['chat-conversations', organizationId],
            (oldData) => {
              if (!oldData) return oldData;

              return oldData.map((conversation) => {
                if (conversation.leadId !== record.lead_id) {
                  return conversation;
                }

                matchedConversation = true;
                return {
                  ...conversation,
                  conversationStatus: normalizeConversationStatus(record.status),
                  externalId: record.external_id || conversation.externalId,
                  platform: record.platform || conversation.platform,
                };
              });
            }
          );

          if (!matchedConversation) {
            queryClient.invalidateQueries({ queryKey: ['chat-conversations', organizationId] });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          devLog('✅ Subscribed to chat conversations realtime (communications + ai_conversations)');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);

  const markAsRead = useCallback(async (leadId: string) => {
    if (!organizationId || !leadId) return;

    const { error } = await supabase
      .from('communications')
      .update({ status: 'read' })
      .eq('organization_id', organizationId)
      .eq('lead_id', leadId)
      .eq('direction', 'inbound')
      .neq('status', 'read');

    if (error) {
      devError('Error marking messages as read:', error);
    } else {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations', organizationId] });
    }
  }, [organizationId, queryClient]);

  const setOnNewMessage = useCallback((callback: ((info: NewMessageInfo) => void) | null) => {
    onNewMessageRef.current = callback;
  }, []);

  const forceRefetch = useCallback(async () => refetch(), [refetch]);

  return {
    conversations: data || [],
    isLoading,
    error,
    refetch: forceRefetch,
    markAsRead,
    setOnNewMessage,
  };
}

function mapSummaryRowToConversation(row: ChatConversationSummaryRow): ChatConversation {
  const lastMessageDirection = row.last_message_direction === 'inbound' || row.last_message_direction === 'outbound'
    ? row.last_message_direction
    : undefined;

  return {
    id: row.id,
    leadId: row.lead_id,
    leadName: row.lead_name || 'Unknown Contact',
    phone: row.phone || '',
    email: row.email || '',
    lastMessage: getConversationPreview({
      content: row.last_message_content,
      direction: lastMessageDirection,
      metadata: row.last_message_metadata,
    }),
    lastMessageAt: row.last_message_at,
    unread: Number(row.unread || 0),
    channel: row.channel,
    messages: [],
    messageCount: Number(row.message_count || 0),
    failedMessageCount: Number(row.failed_message_count || 0),
    externalId: row.external_id || undefined,
    lastMessageDirection,
    linkedBooking: row.linked_booking_id
      ? {
          id: row.linked_booking_id,
          room_name: row.linked_booking_room_name || 'Unknown Room',
          check_in: row.linked_booking_check_in || '',
          check_out: row.linked_booking_check_out || '',
          status: row.linked_booking_status || 'pending',
        }
      : null,
    isAiManaged: row.is_ai_managed !== false,
    leadTemperature: normalizeLeadTemperature(row.lead_temperature),
    conversationStatus: normalizeConversationStatus(row.conversation_status),
    platform: row.platform || row.channel,
    startedAt: row.started_at || row.last_message_at,
  };
}

function normalizeLeadTemperature(value: string | null): 'hot' | 'warm' | 'cold' | null {
  if (value === 'hot' || value === 'warm' || value === 'cold') {
    return value;
  }
  return null;
}

function normalizeConversationStatus(value: string | null): 'active' | 'ended' | 'archived' | undefined {
  if (value === 'active' || value === 'ended' || value === 'archived') {
    return value;
  }
  return undefined;
}

function isFailedCommunication(comm?: Pick<Communication, 'status' | 'metadata'> | null): boolean {
  if (!comm) return false;
  const metadata = comm.metadata as Record<string, unknown> | null;
  return comm.status === 'failed' || metadata?.ai_send_status === 'failed' || metadata?.delivery_status === 'failed';
}

function getFailedCountDelta(previousComm?: Communication | null, nextComm?: Communication | null): number {
  const previousFailed = isFailedCommunication(previousComm);
  const nextFailed = isFailedCommunication(nextComm);
  if (previousFailed === nextFailed) {
    return 0;
  }
  return nextFailed ? 1 : -1;
}

function extractSenderIdFromMetadata(comm: Communication): string | undefined {
  const metadata = comm.metadata as Record<string, unknown> | null;
  if (metadata?.sender_id) {
    return String(metadata.sender_id);
  }
  if (metadata?.external_sender_id) {
    return String(metadata.external_sender_id);
  }
  return undefined;
}
