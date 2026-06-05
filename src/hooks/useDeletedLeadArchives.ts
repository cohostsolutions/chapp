import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface DeletedLeadArchive {
  id: string;
  organization_id: string;
  lead_id: string;
  deleted_by: string | null;
  deleted_at: string;
  expires_at: string;
  lead_data: Record<string, unknown>;
}

export function useDeletedLeadArchives() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const organizationId = profile?.organization_id || null;

  const query = useQuery({
    queryKey: ['deleted-lead-archives', organizationId],
    queryFn: async () => {
      if (!organizationId) return [] as DeletedLeadArchive[];

      const { data, error } = await supabase
        .from('deleted_lead_archives')
        .select('*')
        .eq('organization_id', organizationId)
        .gt('expires_at', new Date().toISOString())
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      return (data || []) as DeletedLeadArchive[];
    },
    enabled: !!organizationId,
  });

  const restoreArchive = useMutation({
    mutationFn: async (archiveId: string) => {
      const { data, error } = await (supabase as any).rpc('restore_deleted_lead_archive', {
        _archive_id: archiveId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['deleted-lead-archives', organizationId] });
      await queryClient.invalidateQueries();
      toast({ title: 'Lead restored', description: 'The deleted lead has been recovered.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Restore failed', description: error.message, variant: 'destructive' });
    },
  });

  return {
    archives: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    restoreArchive,
  };
}