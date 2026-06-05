import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { devLog } from '@/lib/logger';
import { RECOVERY_WINDOW_HOURS } from '@/lib/recoverableDeletion';
import type { 
  LeadRow, 
  LeadInsert, 
  LeadUpdate, 
  LeadStatus,
  LeadFilters, 
  PaginationParams,
  PaginatedResult,
  LeadWithAgent
} from '@/types/database';

const LEADS_QUERY_KEY = 'leads';

interface UseLeadsOptions {
  filters?: LeadFilters;
  pagination?: PaginationParams;
  enableRealtime?: boolean;
}

export function useLeads(options: UseLeadsOptions = {}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { 
    filters = {}, 
    pagination = { page: 1, pageSize: 20 },
    enableRealtime = true 
  } = options;

  // Build query with server-side filtering
  const fetchLeads = async (): Promise<PaginatedResult<LeadWithAgent>> => {
    let query = supabase
      .from('leads')
      .select('*, organizations!inner(name)', { count: 'exact' });

    // Filter by organization for super admin view
    if (filters.organizationId && filters.organizationId !== 'all') {
      query = query.eq('organization_id', filters.organizationId);
    }

    // Apply filters server-side
    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    
    if (filters.temperature && filters.temperature !== 'all') {
      query = query.eq('lead_temperature', filters.temperature);
    }
    
    if (filters.source && filters.source !== 'all') {
      query = query.eq('source', filters.source);
    }
    
    if (filters.assignedAgentId) {
      if (filters.assignedAgentId === 'unassigned') {
        query = query.is('assigned_agent_id', null);
      } else if (filters.assignedAgentId !== 'all') {
        query = query.eq('assigned_agent_id', filters.assignedAgentId);
      }
    }
    
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
    }

    // Apply pagination
    const from = (pagination.page - 1) * pagination.pageSize;
    const to = from + pagination.pageSize - 1;
    
    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    // Fetch assigned agents for leads that have them
    const leadsWithAgents = (data || []).map((lead) => ({
      ...lead,
      organization_name: (lead as { organizations?: { name?: string } }).organizations?.name || null,
    })) as (LeadWithAgent & { organizations?: { name: string }; organization_name?: string })[];
    const agentIds = [...new Set(leadsWithAgents.filter(l => l.assigned_agent_id).map(l => l.assigned_agent_id!))];
    
    if (agentIds.length > 0) {
      const { data: agents } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, is_active, organization_id')
        .in('id', agentIds);
      
      if (agents) {
        const agentMap = new Map(agents.map(a => [a.id, a]));
        leadsWithAgents.forEach(lead => {
          if (lead.assigned_agent_id) {
            lead.assigned_agent = agentMap.get(lead.assigned_agent_id) || null;
          }
        });
      }
    }

    return {
      data: leadsWithAgents,
      count: count || 0,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil((count || 0) / pagination.pageSize)
    };
  };

  const query = useQuery({
    queryKey: [LEADS_QUERY_KEY, filters, pagination],
    queryFn: fetchLeads,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Real-time subscription
  useEffect(() => {
    if (!enableRealtime) return;

    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        (payload) => {
          devLog('Lead change:', payload.eventType, payload);
          
          // Invalidate and refetch on any change
          queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY] });
          
          // Show toast for new leads
          if (payload.eventType === 'INSERT') {
            const newLead = payload.new as LeadRow;
            toast({
              title: 'New Lead',
              description: `${newLead.name} was just added`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enableRealtime, queryClient, toast]);

  // Mutations
  const createLead = useMutation({
    mutationFn: async (lead: LeadInsert) => {
      const { data, error } = await supabase
        .from('leads')
        .insert(lead)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY] });
      toast({ title: 'Lead Created', description: 'New lead added successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, ...updates }: LeadUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, ...updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [LEADS_QUERY_KEY] });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData([LEADS_QUERY_KEY, filters, pagination]);
      
      // Optimistically update to the new value
      queryClient.setQueryData([LEADS_QUERY_KEY, filters, pagination], (old) => {
        const previous = old as { data?: LeadWithAgent[]; count?: number } | undefined;
        if (!previous?.data) return old;
        return {
          ...previous,
          data: previous.data.map((lead) =>
            lead.id === id ? { ...lead, ...updates } : lead
          ),
        };
      });
      
      return { previousData };
    },
    onError: (error: Error, _, context) => {
      // Rollback on error
      queryClient.setQueryData([LEADS_QUERY_KEY, filters, pagination], context?.previousData);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY] });
    }
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string): Promise<'archived' | 'direct'> => {
      const { error } = await (supabase as any).rpc('archive_lead_deletion', {
        _lead_id: id,
      });

      if (!error) return 'archived';
      devLog('archive_lead_deletion failed, attempting direct delete fallback', error);

      const { error: fallbackError } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (fallbackError) throw fallbackError;

      return 'direct';
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: [LEADS_QUERY_KEY] });
      const previousData = queryClient.getQueryData([LEADS_QUERY_KEY, filters, pagination]);
      
      // Optimistically remove the lead
      queryClient.setQueryData([LEADS_QUERY_KEY, filters, pagination], (old) => {
        const previous = old as { data?: LeadWithAgent[]; count?: number } | undefined;
        if (!previous?.data) return old;
        return {
          ...previous,
          data: previous.data.filter((lead) => lead.id !== id),
          count: (previous.count || 0) - 1,
        };
      });
      
      return { previousData };
    },
    onError: (error: Error, _, context) => {
      queryClient.setQueryData([LEADS_QUERY_KEY, filters, pagination], context?.previousData);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
    onSuccess: (mode) => {
      toast({
        title: 'Lead Deleted',
        description:
          mode === 'archived'
            ? `Lead archived for ${RECOVERY_WINDOW_HOURS} hours before permanent removal`
            : 'Lead deleted successfully',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY] });
    }
  });

  const bulkUpdateStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: LeadStatus }) => {
      const { error } = await supabase
        .from('leads')
        .update({ status })
        .in('id', ids);
      if (error) throw error;
    },
    onMutate: async ({ ids, status }) => {
      await queryClient.cancelQueries({ queryKey: [LEADS_QUERY_KEY] });
      const previousData = queryClient.getQueryData([LEADS_QUERY_KEY, filters, pagination]);
      
      // Optimistic update
      queryClient.setQueryData([LEADS_QUERY_KEY, filters, pagination], (old) => {
        const previous = old as { data?: LeadWithAgent[] } | undefined;
        if (!previous?.data) return old;
        return {
          ...previous,
          data: previous.data.map((lead) =>
            ids.includes(lead.id) ? { ...lead, status } : lead
          ),
        };
      });
      
      return { previousData };
    },
    onError: (error: Error, _, context) => {
      queryClient.setQueryData([LEADS_QUERY_KEY, filters, pagination], context?.previousData);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
    onSuccess: (_, { ids }) => {
      toast({ title: 'Status Updated', description: `Updated ${ids.length} leads` });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY] });
    }
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      let archivedCount = 0;
      let directCount = 0;

      for (const id of ids) {
        const { error } = await (supabase as any).rpc('archive_lead_deletion', {
          _lead_id: id,
        });

        if (!error) {
          archivedCount += 1;
          continue;
        }
        devLog('archive_lead_deletion failed in bulk delete, attempting direct delete fallback', error);

        const { error: fallbackError } = await supabase
          .from('leads')
          .delete()
          .eq('id', id);

        if (fallbackError) throw fallbackError;
        directCount += 1;
      }

      return { archivedCount, directCount };
    },
    onSuccess: ({ archivedCount, directCount }, ids) => {
      queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY] });
      toast({
        title: 'Leads Deleted',
        description:
          directCount === 0
            ? `${ids.length} leads archived for ${RECOVERY_WINDOW_HOURS} hours`
            : `${ids.length} leads deleted (${archivedCount} archived, ${directCount} direct)`,
      });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  return {
    // Query state
    leads: query.data?.data || [],
    totalCount: query.data?.count || 0,
    totalPages: query.data?.totalPages || 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    
    // Mutations
    createLead,
    updateLead,
    deleteLead,
    bulkUpdateStatus,
    bulkDelete,
  };
}

// Hook for fetching agents (profiles) for assignment dropdowns
export function useAgents() {
  const query = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000, // Cache for 1 minute
  });

  return {
    agents: query.data || [],
    isLoading: query.isLoading,
  };
}
