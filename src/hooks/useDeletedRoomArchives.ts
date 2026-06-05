import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface DeletedRoomArchive {
  id: string;
  organization_id: string;
  room_id: string;
  deleted_by: string | null;
  deleted_at: string;
  expires_at: string;
  room_data: Record<string, unknown>;
}

export function useDeletedRoomArchives() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const organizationId = profile?.organization_id || null;

  const query = useQuery({
    queryKey: ['deleted-room-archives', organizationId],
    queryFn: async () => {
      if (!organizationId) return [] as DeletedRoomArchive[];

      const { data, error } = await supabase
        .from('deleted_room_archives')
        .select('*')
        .eq('organization_id', organizationId)
        .gt('expires_at', new Date().toISOString())
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      return (data || []) as DeletedRoomArchive[];
    },
    enabled: !!organizationId,
  });

  const restoreArchive = useMutation({
    mutationFn: async (archiveId: string) => {
      const { data, error } = await (supabase as any).rpc('restore_deleted_room_archive', {
        _archive_id: archiveId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['deleted-room-archives', organizationId] });
      await queryClient.invalidateQueries();
      toast({ title: 'Room restored', description: 'The deleted room has been recovered.' });
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