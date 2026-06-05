import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { devLog } from '@/lib/logger';
import type { BookingRow, RoomUnitRow, LeadRow } from '@/types/database';
import { formatInTimeZone } from 'date-fns-tz';
import { parseISO } from 'date-fns';

const BOOKINGS_QUERY_KEY = 'bookings';
const ROOM_UNITS_QUERY_KEY = 'roomUnits';

interface BookingFilters {
  search?: string;
  status?: string;
  roomId?: string;
}

interface PaginationParams {
  page: number;
  pageSize: number;
}

interface UseBookingsOptions {
  filters?: BookingFilters;
  pagination?: PaginationParams;
  enableRealtime?: boolean;
  includeExternalBookings?: boolean; // Include calendar_sync_events as external bookings
}

export interface BookingWithRelations extends BookingRow {
  lead?: Pick<LeadRow, 'id' | 'name' | 'email' | 'phone'> | null;
  room?: Pick<RoomUnitRow, 'id' | 'name' | 'capacity'> | null;
  isExternal?: boolean; // Flag for calendar sync events
  source_platform?: string;
  calendar_name?: string;
}

export interface RoomUnit {
  id: string;
  name: string;
  capacity: number | null;
  is_active: boolean;
  pricing_tiers: { guests: number; price: number }[];
  stay_discounts: { min_nights: number; discount_percent: number }[];
}

interface CalendarSyncEvent {
  id: string;
  room_unit_id: string;
  start_time: string;
  end_time: string;
  title: string | null;
  status: string | null;
  all_day: boolean | null;
  guest_name: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  guest_count: number | null;
  source_platform: string | null;
  calendar_name: string | null;
  calendar_timezone: string | null;
}

export function useBookings(options: UseBookingsOptions = {}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { 
    filters = {}, 
    pagination = { page: 1, pageSize: 50 },
    enableRealtime = true,
    includeExternalBookings = true 
  } = options;

  // Fetch bookings + external calendar sync events
  const fetchBookings = async () => {
    // Fetch local bookings
    let query = supabase
      .from('bookings')
      .select('*, lead:leads(id, name, email, phone), room:room_units(id, name, capacity)', { count: 'exact' });

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters.roomId && filters.roomId !== 'all') {
      query = query.eq('room_unit_id', filters.roomId);
    }

    const from = (pagination.page - 1) * pagination.pageSize;
    const to = from + pagination.pageSize - 1;
    
    query = query
      .order('check_in', { ascending: true })
      .range(from, to);

    const { data: bookingsData, error: bookingsError, count } = await query;

    if (bookingsError) throw bookingsError;

    const localBookings: BookingWithRelations[] = (bookingsData || []).map(b => ({
      ...b,
      isExternal: false,
    }));

    // Also fetch calendar_sync_events if enabled
    let externalBookings: BookingWithRelations[] = [];
    if (includeExternalBookings) {
      let syncQuery = supabase
        .from('calendar_sync_events')
        .select('id, room_unit_id, start_time, end_time, title, status, all_day, guest_name, guest_phone, guest_email, guest_count, source_platform, calendar_name, calendar_timezone');

      if (filters.roomId && filters.roomId !== 'all') {
        syncQuery = syncQuery.eq('room_unit_id', filters.roomId);
      }

      const { data: syncData, error: syncError } = await syncQuery;

      if (syncError) {
        devLog('Error fetching calendar sync events:', syncError);
      } else if (syncData) {
        externalBookings = (syncData as CalendarSyncEvent[]).map(event => {
          const tz = event.calendar_timezone || 'UTC';
          
          let checkInDate: string;
          let checkOutDate: string;
          
          if (event.all_day) {
            checkInDate = event.start_time.slice(0, 10);
            checkOutDate = event.end_time.slice(0, 10);
          } else {
            checkInDate = formatInTimeZone(parseISO(event.start_time), tz, 'yyyy-MM-dd');
            checkOutDate = formatInTimeZone(parseISO(event.end_time), tz, 'yyyy-MM-dd');
          }

          return {
            id: `external-${event.id}`,
            room_unit_id: event.room_unit_id,
            check_in: checkInDate,
            check_out: checkOutDate,
            status: 'external',
            isExternal: true,
            source_platform: event.source_platform || 'unknown',
            calendar_name: event.calendar_name || 'External Calendar',
            guest_count: event.guest_count || 1,
            lead: {
              id: `external-lead-${event.id}`,
              name: event.guest_name || event.title || 'External Booking',
              email: event.guest_email,
              phone: event.guest_phone,
            },
            room: null,
            // Required BookingRow fields with defaults
            organization_id: profile?.organization_id || '',
            lead_id: `external-lead-${event.id}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            notes: null,
            total_price: null,
            booking_source: event.source_platform || 'calendar',
            calendar_event_id: null,
          } as BookingWithRelations;
        });
      }
    }

    // Merge bookings (local first, then external)
    const allBookings = [...localBookings, ...externalBookings];

    return {
      data: allBookings,
      count: (count || 0) + externalBookings.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(((count || 0) + externalBookings.length) / pagination.pageSize)
    };
  };

  // Fetch room units with pricing
  const fetchRooms = async (): Promise<RoomUnit[]> => {
    const { data, error } = await supabase
      .from('room_units')
      .select('id, name, capacity, is_active, pricing_tiers, stay_discounts')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    
    // Parse JSON fields
    return (data || []).map(room => ({
      ...room,
      pricing_tiers: Array.isArray(room.pricing_tiers) ? room.pricing_tiers as { guests: number; price: number }[] : [],
      stay_discounts: Array.isArray(room.stay_discounts) ? room.stay_discounts as { min_nights: number; discount_percent: number }[] : [],
    }));
  };

  const bookingsQuery = useQuery({
    queryKey: [BOOKINGS_QUERY_KEY, filters, pagination, includeExternalBookings],
    queryFn: fetchBookings,
    staleTime: 30000,
  });

  const roomsQuery = useQuery({
    queryKey: [ROOM_UNITS_QUERY_KEY],
    queryFn: fetchRooms,
    staleTime: 60000,
  });

  // Real-time subscription for both bookings and calendar_sync_events
  useEffect(() => {
    if (!enableRealtime) return;

    const channel = supabase
      .channel('bookings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        (payload) => {
          devLog('Booking change:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: [BOOKINGS_QUERY_KEY] });
          
          if (payload.eventType === 'INSERT') {
            toast({
              title: 'New Booking',
              description: 'A new booking was just created',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_sync_events' },
        (payload) => {
          devLog('Calendar sync event change:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: [BOOKINGS_QUERY_KEY] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enableRealtime, queryClient, toast]);

  const createBooking = useMutation({
    mutationFn: async (booking: Omit<BookingRow, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('bookings')
        .insert(booking)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BOOKINGS_QUERY_KEY] });
      toast({ title: 'Booking Created', description: 'New booking added successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const updateBooking = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BookingRow> & { id: string }) => {
      const { data, error } = await supabase
        .from('bookings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: [BOOKINGS_QUERY_KEY] });
      const previousBookings = queryClient.getQueryData([BOOKINGS_QUERY_KEY, filters, pagination, includeExternalBookings]);
      
      // Optimistic update
      queryClient.setQueryData([BOOKINGS_QUERY_KEY, filters, pagination, includeExternalBookings], (old) => {
        const previous = old as { data?: BookingWithRelations[] } | undefined;
        if (!previous?.data) return old;
        return {
          ...previous,
          data: previous.data.map((booking) =>
            booking.id === id ? { ...booking, ...updates } : booking
          ),
        };
      });
      
      return { previousBookings };
    },
    onError: (error: Error, _, context) => {
      queryClient.setQueryData([BOOKINGS_QUERY_KEY, filters, pagination, includeExternalBookings], context?.previousBookings);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [BOOKINGS_QUERY_KEY] });
    },
    onSuccess: () => {
      toast({ title: 'Booking Updated', description: 'Reservation details have been updated' });
    }
  });

  const deleteBooking = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BOOKINGS_QUERY_KEY] });
      toast({ title: 'Booking Deleted', description: 'Reservation has been removed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  return {
    bookings: bookingsQuery.data?.data || [],
    rooms: roomsQuery.data || [] as RoomUnit[],
    totalCount: bookingsQuery.data?.count || 0,
    totalPages: bookingsQuery.data?.totalPages || 0,
    isLoading: bookingsQuery.isLoading || roomsQuery.isLoading,
    isError: bookingsQuery.isError,
    error: bookingsQuery.error,
    refetch: bookingsQuery.refetch,
    createBooking,
    updateBooking,
    deleteBooking,
  };
}

// Standalone hook for fetching room units (for other components)
export function useRoomUnits() {
  const query = useQuery({
    queryKey: [ROOM_UNITS_QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('room_units')
        .select('id, name, capacity, is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  return {
    roomUnits: query.data || [],
    isLoading: query.isLoading,
  };
}
