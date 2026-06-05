import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import type { DealValueFormData } from '@/lib/validations';

export function useUpdateDealValue() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDealValue = useCallback(
    async (leadId: string, dealData: Partial<DealValueFormData>): Promise<boolean> => {
      if (!profile?.organization_id) {
        const errorMsg = 'Organization not found';
        setError(errorMsg);
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Prepare update data - only includes fields that have values
        const updateData: Record<string, any> = {};

        if (dealData.dealValue !== undefined) {
          updateData.deal_value = dealData.dealValue;
        }
        if (dealData.expectedCloseDate) {
          updateData.expected_close_date = dealData.expectedCloseDate;
        }
        if (dealData.dealStage) {
          updateData.deal_stage = dealData.dealStage;
        }
        if (dealData.probability !== undefined) {
          updateData.deal_probability = dealData.probability;
        }

        // Calculate expected revenue (deal value * probability)
        if (dealData.dealValue !== undefined && dealData.probability !== undefined) {
          updateData.expected_revenue = dealData.dealValue * (dealData.probability / 100);
        }

        const { error: supabaseError } = await supabase
          .from('leads')
          .update(updateData)
          .eq('id', leadId)
          .eq('organization_id', profile.organization_id);

        if (supabaseError) throw supabaseError;

        toast({
          title: 'Deal Updated',
          description: 'Deal value information has been updated',
        });

        // Invalidate related queries
        await queryClient.invalidateQueries({ queryKey: ['jay-leads'] });
        await queryClient.invalidateQueries({ queryKey: ['sales_leads'] });

        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to update deal value';
        setError(errorMsg);
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [profile?.organization_id, toast, queryClient]
  );

  return {
    updateDealValue,
    isLoading,
    error,
  };
}
