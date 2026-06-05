import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardSupportTicket {
  id: string;
  subject: string;
  priority: string;
  status: string;
  created_at: string;
}

export function useDashboardSupportTickets(organizationId?: string | null, enabled: boolean = true, limit: number = 5) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['dashboard-support-tickets', organizationId, limit],
    enabled: enabled && !!organizationId,
    queryFn: async (): Promise<DashboardSupportTicket[]> => {
      const { data, error } = await supabase
        .from('helpdesk_tickets')
        .select('id, subject, priority, status, created_at')
        .eq('organization_id', organizationId!)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []) as DashboardSupportTicket[];
    },
    staleTime: 30000,
  });

  useEffect(() => {
    if (!enabled || !organizationId) return;

    const channel = supabase
      .channel(`dashboard-support-tickets-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'helpdesk_tickets',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-support-tickets', organizationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, organizationId, queryClient]);

  return {
    supportTickets: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}