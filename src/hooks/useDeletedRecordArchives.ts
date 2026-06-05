import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface DeletedRecordArchive {
  id: string;
  organization_id: string;
  table_name: string;
  record_id: string;
  deleted_by: string | null;
  deleted_at: string;
  expires_at: string;
  display_label: string | null;
  record_data: Record<string, unknown>;
}

export function useDeletedRecordArchives(tableName?: string) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const organizationId = profile?.organization_id || null;

  const query = useQuery({
    queryKey: ['deleted-record-archives', organizationId, tableName || 'all'],
    queryFn: async () => {
      if (!organizationId) return [] as DeletedRecordArchive[];

      await supabase
        .from('deleted_record_archives')
        .delete()
        .eq('organization_id', organizationId)
        .lt('expires_at', new Date().toISOString());

      let queryBuilder = supabase
        .from('deleted_record_archives')
        .select('*')
        .eq('organization_id', organizationId)
        .gt('expires_at', new Date().toISOString())
        .order('deleted_at', { ascending: false });

      if (tableName) {
        queryBuilder = queryBuilder.eq('table_name', tableName);
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;
      return (data || []) as DeletedRecordArchive[];
    },
    enabled: !!organizationId,
  });

  useEffect(() => {
    if (!query.error) {
      return;
    }

    const message = query.error instanceof Error ? query.error.message : 'Failed to load deleted items.';
    toast({ title: 'Deleted items unavailable', description: message, variant: 'destructive' });
  }, [query.error, toast]);

  const restoreArchive = useMutation({
    mutationFn: async (archiveId: string) => {
      const { data, error } = await (supabase as any).rpc('restore_deleted_record_archive', {
        _archive_id: archiveId,
      });

      if (error) throw error;
      return data as string;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['deleted-record-archives', organizationId] });
      await queryClient.invalidateQueries();
      toast({ title: 'Item restored', description: 'The deleted record has been recovered.' });
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