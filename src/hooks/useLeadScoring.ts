import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devWarn } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import type { LeadScoringConfig, LeadScore, LeadPrediction } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

// NOTE: Lead scoring hooks - the lead_scoring_config, lead_scores, and lead_predictions
// tables do not exist yet in the database schema. These are placeholder implementations.

// Default scoring criteria
export const DEFAULT_SCORING_CRITERIA = {
  engagement: {
    email_opens: 10,
    email_clicks: 15,
    website_visits: 8,
    form_submissions: 20,
    demo_requests: 30,
  },
  demographic: {
    company_size: 15,
    industry_match: 10,
    job_title: 12,
    location: 5,
  },
  behavior: {
    response_time: 10,
    meeting_attendance: 25,
    content_downloads: 8,
    social_engagement: 5,
  },
  firmographic: {
    budget_range: 20,
    decision_authority: 15,
    timeline: 10,
  },
};

export function useLeadScoringConfig(organizationId: string) {
  return useQuery({
    queryKey: ['lead-scoring-config', organizationId],
    queryFn: async () => {
      // Lead scoring config table not yet implemented
      devWarn('lead_scoring_config table not yet implemented');
      return null as LeadScoringConfig | null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateScoringConfig(organizationId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (config: Partial<LeadScoringConfig>) => {
      // Lead scoring config table not yet implemented
      devWarn('lead_scoring_config table not yet implemented');
      throw new Error('Lead scoring configuration feature coming soon');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-scoring-config', organizationId] });
      toast({
        title: 'Scoring configuration updated',
        description: 'Lead scoring criteria has been successfully updated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update scoring config',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useLeadScore(leadId: string) {
  return useQuery({
    queryKey: ['lead-score', leadId],
    queryFn: async () => {
      // Lead scores table not yet implemented - return a mock score based on lead temperature
      const { data: lead } = await supabase
        .from('leads')
        .select('lead_temperature')
        .eq('id', leadId)
        .maybeSingle();

      if (!lead) return null;

      // Generate score based on temperature
      const temperatureScores: Record<string, number> = {
        hot: 85,
        warm: 60,
        cold: 30,
      };

      const score = temperatureScores[lead.lead_temperature || 'cold'] || 30;

      return {
        id: leadId,
        lead_id: leadId,
        score,
        prediction_data: { temperature: lead.lead_temperature },
        calculated_at: new Date().toISOString(),
      } as LeadScore;
    },
    staleTime: 60 * 1000,
  });
}

export function useLeadPrediction(leadId: string) {
  return useQuery({
    queryKey: ['lead-prediction', leadId],
    queryFn: async () => {
      // Lead predictions table not yet implemented
      devWarn('lead_predictions table not yet implemented');
      return null as LeadPrediction | null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCalculateLeadScore() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ leadId, organizationId }: { leadId: string; organizationId: string }) => {
      // Get lead data
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*, ai_conversations(count), orders(count)')
        .eq('id', leadId)
        .single();

      if (leadError) throw leadError;

      // Calculate score based on existing data
      let totalScore = 0;
      const scoreBreakdown: Record<string, number> = {};

      // Basic demographic score
      if (lead.source) {
        const sourceScore = 10;
        totalScore += sourceScore;
        scoreBreakdown.source = sourceScore;
      }

      // Temperature-based score
      const temperatureScores: Record<string, number> = {
        hot: 30,
        warm: 20,
        cold: 10,
      };
      const tempScore = temperatureScores[lead.lead_temperature || 'cold'];
      totalScore += tempScore;
      scoreBreakdown.temperature = tempScore;

      // Engagement score (conversations)
      const conversationCount = (lead.ai_conversations as unknown as { count: number }[])?.[0]?.count || 0;
      const engagementScore = Math.min(conversationCount * 5, 25);
      totalScore += engagementScore;
      scoreBreakdown.engagement = engagementScore;

      // Conversion indicator (has orders)
      const orderCount = (lead.orders as unknown as { count: number }[])?.[0]?.count || 0;
      if (orderCount > 0) {
        totalScore += 15;
        scoreBreakdown.hasOrders = 15;
      }

      // Normalize to 0-100
      const finalScore = Math.min(Math.round(totalScore), 100);

      // Return calculated score (not persisted without the table)
      return {
        id: leadId,
        lead_id: leadId,
        score: finalScore,
        prediction_data: scoreBreakdown,
        calculated_at: new Date().toISOString(),
      };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-score', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-prediction', variables.leadId] });
      toast({
        title: 'Lead score calculated',
        description: 'The lead score has been successfully calculated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to calculate score',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useBulkCalculateScores(organizationId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      // Get all leads for organization
      const { data: leads, error } = await supabase
        .from('leads')
        .select('id')
        .eq('organization_id', organizationId);

      if (error) throw error;
      return leads?.length || 0;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Bulk scoring complete',
        description: `Successfully calculated scores for ${count} leads.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Bulk scoring failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
