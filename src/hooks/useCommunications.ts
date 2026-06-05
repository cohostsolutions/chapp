import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { devLog } from '@/lib/logger';
import { archiveRecoverableRecordDeletion, confirmRecoverableDeletion, DeletionCancelledError, RECOVERY_WINDOW_HOURS } from '@/lib/recoverableDeletion';
import type { Tables } from '@/integrations/supabase/types';

type Communication = Tables<'communications'>;
type MessageTemplate = Tables<'message_templates'>;
type SocialPlatform = 'whatsapp' | 'messenger' | 'instagram';

/**
 * Hook for fetching communications for a lead or organization.
 * Supports filtering by leadId and/or organizationId with retry logic.
 * 
 * @param leadId - Optional lead ID to filter communications
 * @param organizationId - Optional organization ID to filter communications
 * @returns Communications array and query state
 */
export function useCommunications(leadId?: string, organizationId?: string) {
  return useQuery({
    queryKey: ['communications', leadId, organizationId],
    queryFn: async () => {
      let query = supabase
        .from('communications')
        .select('id, lead_id, organization_id, channel, direction, role, content, subject, status, external_id, metadata, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (leadId) {
        query = query.eq('lead_id', leadId);
      }
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as Communication[];
    },
    staleTime: 30 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

/**
 * Hook for fetching unread message counts for multiple leads.
 * Efficiently aggregates counts in a single query.
 * 
 * @param leadIds - Array of lead IDs to check
 * @returns Record of leadId -> unread count
 */
export function useUnreadCounts(leadIds: string[]) {
  return useQuery({
    queryKey: ['unread-counts', leadIds],
    queryFn: async () => {
      if (leadIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('communications')
        .select('lead_id')
        .in('lead_id', leadIds)
        .eq('direction', 'inbound')
        .neq('status', 'read');

      if (error) throw error;
      
      // Count unread messages per lead
      const counts: Record<string, number> = {};
      data?.forEach(comm => {
        if (comm.lead_id) {
          counts[comm.lead_id] = (counts[comm.lead_id] || 0) + 1;
        }
      });
      
      return counts;
    },
    enabled: leadIds.length > 0,
    staleTime: 30 * 1000,
  });
}

export function useCreateCommunication() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (communication: Omit<Communication, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('communications')
        .insert(communication)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to log communication',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useSendSMS() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  return useMutation({
    mutationFn: async ({
      organizationId,
      leadId,
      toNumber,
      fromNumber,
      message,
    }: {
      organizationId: string;
      leadId: string;
      toNumber: string;
      fromNumber?: string;
      message: string;
    }) => {
      if (!leadId) {
        throw new Error('Lead is required to send SMS');
      }
      if (!toNumber) {
        throw new Error('Phone number is required to send SMS');
      }

      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      // Call the send-sms edge function
      const { data: sendData, error: sendError } = await supabase.functions.invoke('send-sms', {
        body: {
          to: toNumber,
          from: fromNumber,
          message,
          organizationId,
          leadId,
        },
        signal,
      });

      if (sendError) throw sendError;
      return sendData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });

      const newComm = (data as { communication?: Communication })?.communication;
      if (newComm) {
        queryClient.setQueriesData({ queryKey: ['communications'] }, (oldData) => {
          if (!Array.isArray(oldData)) return oldData;
          const alreadyExists = oldData.some((comm) => comm.id === newComm.id);
          if (alreadyExists) return oldData;
          return [newComm, ...oldData];
        });
      }

      toast({
        title: 'SMS sent successfully',
        description: 'Your message has been delivered.',
      });
    },
    onError: (error: Error) => {
      // Don't show error if request was aborted
      if (error.name === 'AbortError') {
        devLog('SMS send cancelled');
        return;
      }
      toast({
        title: 'Failed to send SMS',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      // Cleanup: clear the abort controller
      abortControllerRef.current = null;
    },
  });
}

export function useSendSocialMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  return useMutation({
    mutationFn: async ({
      platform,
      organizationId,
      leadId,
      recipientId,
      message,
    }: {
      platform: SocialPlatform;
      organizationId: string;
      leadId?: string;
      recipientId: string;
      message: string;
    }) => {
      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      const invoke = () =>
        supabase.functions.invoke('send-social-message', {
          body: {
            platform,
            organizationId,
            leadId,
            recipientId,
            message,
          },
          signal,
        });

      const run = async (didRetry: boolean): Promise<unknown> => {
        const { data, error } = await invoke();

        if (error) {
          // Most common cause: stale/revoked session token.
          if (error instanceof FunctionsHttpError && error.context.status === 401) {
            if (!didRetry) {
              const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
              if (!refreshError && refreshed.session) {
                return run(true);
              }
            }

            await supabase.auth.signOut();
            throw new Error('Your session expired. Please sign in again.');
          }

          throw error;
        }

        if (data?.error) throw new Error(data.error);
        return data;
      };

      return run(false);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });
      const platformLabels: Record<string, string> = {
        whatsapp: 'WhatsApp',
        messenger: 'Messenger',
        instagram: 'Instagram',
      };
      toast({
        title: `${platformLabels[variables.platform]} message sent`,
        description: 'Your message has been delivered.',
      });
    },
    onError: (error: Error) => {
      // Don't show error if request was aborted
      if (error.name === 'AbortError') {
        devLog('Social message send cancelled');
        return;
      }
      toast({
        title: 'Failed to send message',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      // Cleanup: clear the abort controller
      abortControllerRef.current = null;
    },
  });
}

export function useSendEmail() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  return useMutation({
    mutationFn: async ({
      organizationId,
      leadId,
      to,
      subject,
      message,
    }: {
      organizationId: string;
      leadId?: string;
      to: string;
      subject: string;
      message: string;
    }) => {
      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          organizationId,
          leadId,
          to,
          subject,
          message,
        },
        signal,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });
      toast({
        title: 'Email sent successfully',
        description: 'Your email has been delivered.',
      });
    },
    onError: (error: Error) => {
      // Don't show error if request was aborted
      if (error.name === 'AbortError') {
        devLog('Email send cancelled');
        return;
      }
      toast({
        title: 'Failed to send email',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      // Cleanup: clear the abort controller
      abortControllerRef.current = null;
    },
  });
}

export function useSendEmailSMTP() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  return useMutation({
    mutationFn: async ({
      organizationId,
      leadId,
      to,
      subject,
      message,
      emailIntegrationId,
    }: {
      organizationId: string;
      leadId?: string;
      to: string;
      subject: string;
      message: string;
      emailIntegrationId?: string;
    }) => {
      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      const { data, error } = await supabase.functions.invoke('send-email-smtp', {
        body: {
          organizationId,
          leadId,
          to,
          subject,
          message,
          emailIntegrationId,
        },
        signal,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });
      toast({
        title: 'Email sent successfully',
        description: 'Your email has been sent via your configured email account.',
      });
    },
    onError: (error: Error) => {
      // Don't show error if request was aborted
      if (error.name === 'AbortError') {
        devLog('Email send cancelled');
        return;
      }
      toast({
        title: 'Failed to send email',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      // Cleanup: clear the abort controller
      abortControllerRef.current = null;
    },
  });
}

export function useSendWhatsApp() {
  const sendSocialMessage = useSendSocialMessage();
  
  return {
    ...sendSocialMessage,
    mutateAsync: async (params: {
      organizationId: string;
      leadId?: string;
      toNumber: string;
      message: string;
    }) => {
      return sendSocialMessage.mutateAsync({
        platform: 'whatsapp',
        organizationId: params.organizationId,
        leadId: params.leadId,
        recipientId: params.toNumber,
        message: params.message,
      });
    },
  };
}

export function useInitiateCall() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      organizationId,
      leadId,
      toNumber,
      fromNumber,
      durationSeconds,
      status,
      notes,
    }: {
      organizationId: string;
      leadId: string;
      toNumber: string;
      fromNumber?: string;
      durationSeconds?: number;
      status?: string;
      notes?: string;
    }) => {
      // Log the call in call_logs table
      const { data, error } = await supabase
        .from('call_logs')
        .insert({
          lead_id: leadId,
          agent_id: null, // Will be populated by auth context if needed
          status: status || 'completed',
          duration_seconds: durationSeconds || 0,
          notes: notes || `Call to ${toNumber}`,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      toast({
        title: 'Call logged',
        description: 'Call has been recorded successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to log call',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useRetryCommunication() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (communicationId: string) => {
      const { data, error } = await supabase.functions.invoke('retry-message', {
        body: { communicationId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });
      toast({ title: 'Retry scheduled', description: 'We attempted to resend the message.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Retry failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useMessageTemplates(organizationId: string, channel?: string) {
  return useQuery({
    queryKey: ['message-templates', organizationId, channel],
    queryFn: async () => {
      let query = supabase
        .from('message_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name');

      // If channel is specified, include both that channel AND 'all' templates
      if (channel) {
        query = query.or(`channel.eq.${channel},channel.eq.all`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MessageTemplate[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!organizationId,
  });
}

export function useCreateMessageTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (template: Omit<MessageTemplate, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('message_templates')
        .insert(template)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast({
        title: 'Template created',
        description: 'Message template has been saved successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateMessageTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; content?: string; channel?: string; attachment_url?: string | null; attachment_name?: string | null }) => {
      const { data, error } = await supabase
        .from('message_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast({
        title: 'Template updated',
        description: 'Message template has been updated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteMessageTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name?: string }) => {
      const templateLabel = name || 'this message template';

      if (!confirmRecoverableDeletion(templateLabel)) {
        throw new DeletionCancelledError();
      }

      await archiveRecoverableRecordDeletion('message_templates', id, templateLabel);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast({
        title: 'Template deleted',
        description: `Message template deleted. It can be restored from Deleted Items for ${RECOVERY_WINDOW_HOURS} hours.`,
      });
    },
    onError: (error: Error) => {
      if (error instanceof DeletionCancelledError) return;

      toast({
        title: 'Failed to delete template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateCommunicationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from('communications')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });
    },
  });
}

export function useRealtimeCommunications(organizationId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel('communications-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'communications',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          devLog('Communication update received:', payload.eventType);
          // Invalidate the communications query to trigger a refetch
          queryClient.invalidateQueries({ queryKey: ['communications'] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          devLog('Subscribed to communications realtime updates');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);
}

// Mark communications as read/seen when agent views them
export function useMarkCommunicationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (communicationIds: string[]) => {
      if (communicationIds.length === 0) return;
      
      const { error } = await supabase
        .from('communications')
        .update({ status: 'read' })
        .in('id', communicationIds)
        .eq('direction', 'inbound')
        .neq('status', 'read');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });
    },
  });
}
