import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DashboardStats, TemperatureStats } from '@/types/database';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const startOfLastWeek = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch all stats in parallel
      const [
        totalLeadsResult,
        lastWeekLeadsResult,
        activeConvosResult,
        lastWeekConvosResult,
        callsTodayResult,
        callsYesterdayResult,
        convertedResult,
        lastWeekConvertedResult,
      ] = await Promise.all([
        // Total leads
        supabase.from('leads').select('id', { count: 'exact', head: true }),
        // Leads from last week (for comparison)
        supabase.from('leads').select('id', { count: 'exact', head: true })
          .lt('created_at', startOfWeek),
        // Active conversations
        supabase.from('ai_conversations').select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        // Active conversations last week
        supabase.from('ai_conversations').select('id', { count: 'exact', head: true })
          .eq('status', 'active')
          .lt('created_at', startOfWeek),
        // Calls today
        supabase.from('call_logs').select('id', { count: 'exact', head: true })
          .gte('created_at', startOfToday),
        // Calls yesterday (for comparison)
        supabase.from('call_logs').select('id', { count: 'exact', head: true })
          .lt('created_at', startOfToday)
          .gte('created_at', new Date(new Date().setDate(new Date().getDate() - 1)).toISOString()),
        // Converted leads
        supabase.from('leads').select('id', { count: 'exact', head: true })
          .eq('status', 'converted'),
        // Converted leads last week
        supabase.from('leads').select('id', { count: 'exact', head: true })
          .eq('status', 'converted')
          .lt('created_at', startOfWeek),
      ]);

      const totalLeads = totalLeadsResult.count || 0;
      const lastWeekLeads = lastWeekLeadsResult.count || 0;
      const activeConversations = activeConvosResult.count || 0;
      const lastWeekConvos = lastWeekConvosResult.count || 0;
      const callsToday = callsTodayResult.count || 0;
      const callsYesterday = callsYesterdayResult.count || 0;
      const converted = convertedResult.count || 0;
      const lastWeekConverted = lastWeekConvertedResult.count || 0;

      // Calculate changes
      const totalLeadsChange = lastWeekLeads > 0 
        ? Math.round(((totalLeads - lastWeekLeads) / lastWeekLeads) * 100) 
        : 0;
      const activeConversationsChange = lastWeekConvos > 0
        ? Math.round(((activeConversations - lastWeekConvos) / lastWeekConvos) * 100)
        : 0;
      const callsTodayChange = callsYesterday > 0
        ? Math.round(((callsToday - callsYesterday) / callsYesterday) * 100)
        : 0;
      
      const conversionRate = totalLeads > 0 ? (converted / totalLeads) * 100 : 0;
      const lastWeekConversionRate = lastWeekLeads > 0 ? (lastWeekConverted / lastWeekLeads) * 100 : 0;
      const conversionRateChange = lastWeekConversionRate > 0
        ? Math.round(conversionRate - lastWeekConversionRate)
        : 0;

      return {
        totalLeads,
        totalLeadsChange,
        activeConversations,
        activeConversationsChange,
        callsToday,
        callsTodayChange,
        conversionRate: Math.round(conversionRate * 10) / 10,
        conversionRateChange,
      };
    },
    staleTime: 60000, // Refresh every minute
    refetchInterval: 60000,
  });
}

export function useTemperatureStats() {
  return useQuery({
    queryKey: ['temperature-stats'],
    queryFn: async (): Promise<TemperatureStats> => {
      const [coldResult, warmResult, hotResult] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('lead_temperature', 'cold'),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('lead_temperature', 'warm'),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('lead_temperature', 'hot'),
      ]);

      return {
        cold: coldResult.count || 0,
        warm: warmResult.count || 0,
        hot: hotResult.count || 0,
      };
    },
    staleTime: 30000,
  });
}

export function useRecentLeads(limit: number = 5) {
  return useQuery({
    queryKey: ['recent-leads', limit],
    queryFn: async () => {
      const { data: leads, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      if (!leads) return [];

      // Fetch agent info separately if needed
      const agentIds = leads
        .map(l => l.assigned_agent_id)
        .filter((id): id is string => !!id);

      let agentMap: Record<string, { id: string; full_name: string | null; email: string }> = {};
      
      if (agentIds.length > 0) {
        const { data: agents } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', agentIds);
        
        if (agents) {
          agentMap = agents.reduce((acc, agent) => {
            acc[agent.id] = agent;
            return acc;
          }, {} as typeof agentMap);
        }
      }

      return leads.map(lead => ({
        ...lead,
        assigned_agent: lead.assigned_agent_id ? agentMap[lead.assigned_agent_id] || null : null,
      }));
    },
    staleTime: 30000,
  });
}
