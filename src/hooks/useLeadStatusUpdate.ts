import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export function useLeadStatusUpdate() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const updateLeadStatus = useCallback(
    async (leadId: string, status: 'converted' | 'lost', notes?: string) => {
      if (!profile?.organization_id) {
        toast({
          title: 'Error',
          description: 'Organization not found',
          variant: 'destructive',
        });
        return false;
      }

      setIsLoading(true);
      try {
        const { error } = await supabase
          .from('leads')
          .update({
            status,
            notes: notes ? `${notes}\n[Updated: ${new Date().toLocaleString()}]` : undefined,
          })
          .eq('id', leadId)
          .eq('organization_id', profile.organization_id);

        if (error) throw error;

        toast({
          title: status === 'converted' ? 'Deal Won!' : 'Deal Lost',
          description: `Lead status updated to ${status}`,
          variant: status === 'converted' ? 'default' : 'destructive',
        });

        // Invalidate sales data queries
        await queryClient.invalidateQueries({ queryKey: ['jay-leads'] });
        await queryClient.invalidateQueries({ queryKey: ['sales_leads'] });

        return true;
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to update lead status',
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
    updateLeadStatus,
    isLoading,
  };
}
