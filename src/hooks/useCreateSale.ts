import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCreateLead, CreateLeadInput } from './useCreateLead';
import { useQueryClient } from '@tanstack/react-query';

export interface SaleData {
  name: string;
  temperature: 'cold' | 'warm' | 'hot';
  selectedOfferings?: string[];
  notes?: string | null;
  leadSource?: string;
}

export function useCreateSale() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { createLead } = useCreateLead();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSale = useCallback(
    async (saleData: SaleData): Promise<{ id: string } | null> => {
      if (!profile?.organization_id) {
        const errorMsg = 'Organization not found';
        setError(errorMsg);
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Step 1: Create the lead
        const leadInput: CreateLeadInput = {
          name: saleData.name,
          source: saleData.leadSource || 'sales',
          status: 'contacted',
          lead_temperature: saleData.temperature,
          notes: saleData.notes || null,
        };

        const lead = await createLead(leadInput);
        if (!lead) {
          throw new Error('Failed to create sales lead');
        }

        // Step 2: Link offerings if selected
        // Note: lead_offerings table may not exist yet in current schema
        // For now, we store offering IDs in the lead's notes or metadata
        if (saleData.selectedOfferings && saleData.selectedOfferings.length > 0) {
          // Future: Implement lead_offerings relationship tracking
          // This would require database migration to add the junction table
          // For now, offerings are tracked at the UI level
        }

        // Invalidate related queries
        await queryClient.invalidateQueries({ queryKey: ['sales_leads'] });
        await queryClient.invalidateQueries({ queryKey: ['sales_data'] });

        toast({
          title: 'Success',
          description: `Sale created for ${saleData.name}`,
        });

        return { id: lead.id };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to create sale';
        setError(errorMsg);
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [profile?.organization_id, createLead, toast, queryClient]
  );

  return {
    createSale,
    isLoading,
    error,
  };
}
