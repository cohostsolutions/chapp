import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface LeadOfferingCount {
  leadId: string;
  count: number;
  offerings: Array<{
    id: string;
    name: string;
  }>;
}

/**
 * Fetch offering counts for all leads in an organization
 * Note: This requires lead_offerings junction table to be created
 * For now, returns empty counts as placeholder
 */
export function useLeadOfferingCounts() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['lead-offering-counts', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return new Map<string, LeadOfferingCount>();

      // TODO: Implement when lead_offerings table is created
      // Fetch lead_offerings relationships
      // const { data, error } = await supabase
      //   .from('lead_offerings')
      //   .select(`lead_id, offering:offerings(id, name)`)
      //   .eq('organization_id', profile.organization_id);

      // For now, return empty map
      return new Map<string, LeadOfferingCount>();
    },
    enabled: !!profile?.organization_id,
    staleTime: 15000,
  });
}

/**
 * Fetch offering count for a specific lead
 * Note: This requires lead_offerings junction table to be created
 */
export function useLeadOfferingCount(leadId?: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['lead-offering-count', leadId, profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id || !leadId) {
        return { leadId: leadId || '', count: 0, offerings: [] };
      }

      // TODO: Implement when lead_offerings table is created
      // const { data, error } = await supabase
      //   .from('lead_offerings')
      //   .select(`offering:offerings(id, name)`)
      //   .eq('lead_id', leadId)
      //   .eq('organization_id', profile.organization_id);

      // For now, return empty
      return {
        leadId,
        count: 0,
        offerings: [],
      };
    },
    enabled: !!profile?.organization_id && !!leadId,
    staleTime: 15000,
  });
}
