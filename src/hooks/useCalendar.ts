import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export interface CalendarEvent {
  id: string;
  organization_id: string;
  user_id?: string | null;
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean;
  location?: string | null;
  event_type?: string | null;
  related_lead_id?: string | null;
  related_booking_id?: string | null;
  related_order_id?: string | null;
  external_calendar_id?: string | null;
  metadata?: Json | null;
  appointment_status?: 'requested' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | null;
  appointment_source?: 'manual' | 'jay_ai' | 'external_sync' | null;
  created_at: string;
  updated_at: string;
}

export function useCalendarEvents(organizationId: string, userId?: string) {
  return useQuery({
    queryKey: ['calendar-events', organizationId, userId],
    queryFn: async () => {
      let query = supabase
        .from('calendar_events')
        .select('*')
        .eq('organization_id', organizationId)
        .order('start_time', { ascending: true });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CalendarEvent[];
    },
    staleTime: 60 * 1000,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .insert(event)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({
        title: 'Event created',
        description: 'Calendar event has been added.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create event',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CalendarEvent> & { id: string }) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({
        title: 'Event updated',
        description: 'Changes have been saved.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update event',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({
        title: 'Event deleted',
        description: 'The event has been removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete event',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
