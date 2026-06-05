import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface DeletedBookingArchive {
  id: string;
  organization_id: string;
  booking_id: string;
  deleted_by: string | null;
  deleted_at: string;
  expires_at: string;
  booking_data: Record<string, unknown>;
  lead_data: Record<string, unknown> | null;
  was_lead_deleted: boolean;
}

export function useDeletedBookingArchives() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const organizationId = profile?.organization_id || null;

  const query = useQuery({
    queryKey: ['deleted-booking-archives', organizationId],
    queryFn: async () => {
      if (!organizationId) return [] as DeletedBookingArchive[];

      await supabase
        .from('deleted_booking_archives')
        .delete()
        .eq('organization_id', organizationId)
        .lt('expires_at', new Date().toISOString());

      const { data, error } = await supabase
        .from('deleted_booking_archives')
        .select('*')
        .eq('organization_id', organizationId)
        .gt('expires_at', new Date().toISOString())
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      return (data || []) as DeletedBookingArchive[];
    },
    enabled: !!organizationId,
  });

  const restoreArchive = useMutation({
    mutationFn: async (archiveId: string) => {
      const { data, error } = await (supabase as any).rpc('restore_deleted_booking_archive', {
        _archive_id: archiveId,
      });

      if (error) throw error;
      return data as string;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['deleted-booking-archives', organizationId] });
      await queryClient.invalidateQueries({ queryKey: ['accommodation-bookings', organizationId] });
      await queryClient.invalidateQueries({ queryKey: ['accommodation-orphan-leads', organizationId] });
      toast({ title: 'Booking restored', description: 'The deleted booking has been recovered.' });
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
    latestDeletedAt: useMemo(() => query.data?.[0]?.deleted_at || null, [query.data]),
  };
}