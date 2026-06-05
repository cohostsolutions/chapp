import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface BookingNoteHistoryEntry {
  id: string;
  booking_id: string;
  note_text: string | null;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
}

export function useBookingNotes(bookingId?: string) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch note history for a booking
  const {
    data: history = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['booking-note-history', bookingId],
    queryFn: async () => {
      if (!bookingId) return [];

      const { data, error } = await (supabase as any)
        .from('booking_note_history')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as BookingNoteHistoryEntry[];
    },
    enabled: !!bookingId,
  });

  // Add note to history
  const addNoteHistoryMutation = useMutation({
    mutationFn: async ({ 
      bookingId, 
      noteText,
      userName
    }: { 
      bookingId: string; 
      noteText: string | null;
      userName?: string;
    }) => {
      if (!profile?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await (supabase as any)
        .from('booking_note_history')
        .insert({
          booking_id: bookingId,
          note_text: noteText,
          user_id: profile.id,
          user_name: userName || profile.full_name || profile.email || 'Unknown User',
        })
        .select()
        .single();

      if (error) throw error;
      return data as BookingNoteHistoryEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-note-history'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to save note history: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const addNoteHistory = useCallback((bookingId: string, noteText: string | null, userName?: string) => {
    return addNoteHistoryMutation.mutateAsync({ bookingId, noteText, userName });
  }, [addNoteHistoryMutation]);

  return {
    history,
    isLoading,
    addNoteHistory,
    isSaving: addNoteHistoryMutation.isPending,
    refetch,
  };
}
