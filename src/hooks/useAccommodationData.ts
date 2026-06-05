import { useState, useEffect, useMemo, useCallback } from 'react';
import { devError } from '@/lib/logger';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Json } from '@/integrations/supabase/types';
import {
  getAccommodationWritePropertyId,
  normalizeAccommodationSelectedPropertyId,
} from '@/lib/accommodationPropertySelection';
import { hasBookingOverlap } from '@/lib/bookingOperations';

// Types
export interface PricingTier {
  guests: number;
  price: number;
}

export interface StayDiscount {
  min_nights: number;
  discount_percent: number;
}

export interface Property {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  region?: string | null;
  country?: string | null;
  postal_code?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomUnit {
  id: string;
  organization_id: string;
  property_id?: string;
  name: string;
  description: string | null;
  pricing_country?: string | null;
  pricing_region?: string | null;
  pricing_city?: string | null;
  pricing_district?: string | null;
  capacity: number | null;
  is_active: boolean;
  calendar_ids: string[];
  calendar_sources: Json;
  amenities: Json;
  image_url: string | null;
  image_urls: string[];
  display_order: number;
  category: string | null;
  price_per_night: number | null;
  pricing_tiers: PricingTier[];
  stay_discounts: StayDiscount[];
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

export interface BookingWithRelations {
  id: string;
  room_unit_id: string;
  property_id?: string;
  lead_id: string;
  check_in: string;
  check_out: string;
  guest_count: number | null;
  status: string;
  notes: string | null;
  total_price: number | null;
  payment_status?: string;
  booking_source: string | null;
  calendar_event_id: string | null;
  created_at: string;
  updated_at: string;
  room?: { name: string; price_per_night?: number | null } | null;
  lead?: Lead | null;
  isExternal?: boolean;
  title?: string;
  guest_name?: string | null;
  guest_phone?: string | null;
  guest_email?: string | null;
  source_platform?: string;
  calendar_name?: string;
  raw_description?: string | null;
}

export interface CalendarSyncEvent {
  id: string;
  room_unit_id: string;
  property_id?: string;
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
  raw_description: string | null;
  calendar_timezone: string | null;
  google_event_id: string;
}

export type ViewMode = 'day' | 'week' | 'month';
export type DateFilter = 'all' | 'today' | 'upcoming' | 'past' | 'this_week' | 'this_month' | 'custom';
export type SortOption = 'check_in_asc' | 'check_in_desc' | 'created_at_desc' | 'guest_name';

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export type SearchScope = 'all' | 'guest' | 'contact' | 'notes';

export interface AccommodationFilters {
  searchTerm: string;
  searchScope: SearchScope;
  statusFilter: string;
  roomFilter: string;
  dateFilter: DateFilter;
  customDateRange: DateRange;
  sortOption: SortOption;
}

const defaultFilters: AccommodationFilters = {
  searchTerm: '',
  searchScope: 'all',
  statusFilter: 'all',
  roomFilter: 'all',
  dateFilter: 'upcoming',
  customDateRange: { from: undefined, to: undefined },
  sortOption: 'check_in_asc',
};

export function useAccommodationData() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Filters state
  const [filters, setFilters] = useState<AccommodationFilters>(defaultFilters);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  
  // Availability view state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');

  // Properties
  const {
    data: properties = [],
    isLoading: propertiesLoading,
  } = useQuery({
    queryKey: ['accommodation-properties', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [] as Property[];
      const { data, error } = await (supabase as any)
        .from('properties')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at');
      if (error) throw error;
      return (data || []) as Property[];
    },
    enabled: !!profile?.organization_id,
    staleTime: 30000,
  });

  useEffect(() => {
    const normalizedPropertyId = normalizeAccommodationSelectedPropertyId(selectedPropertyId, properties);

    if (normalizedPropertyId !== selectedPropertyId) {
      setSelectedPropertyId(normalizedPropertyId);
    }
  }, [selectedPropertyId, properties]);

  const getWritePropertyId = useCallback(() => {
    return getAccommodationWritePropertyId(selectedPropertyId, properties);
  }, [selectedPropertyId, properties]);

  // Fetch rooms
  const {
    data: rooms = [],
    isLoading: roomsLoading,
    refetch: refetchRooms,
  } = useQuery({
    queryKey: ['accommodation-rooms', profile?.organization_id, selectedPropertyId],
    queryFn: async () => {
      if (!profile?.organization_id) return [] as RoomUnit[];
      const { data, error } = await (supabase as any)
        .from('room_units')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq(selectedPropertyId !== 'all' ? 'property_id' : 'organization_id', selectedPropertyId !== 'all' ? selectedPropertyId : profile.organization_id)
        .order('display_order');

      if (error) throw error;
      
      return ((data || []) as any[]).map(room => ({
        ...room,
        pricing_tiers: (Array.isArray(room.pricing_tiers) ? room.pricing_tiers : []) as unknown as PricingTier[],
        stay_discounts: (Array.isArray(room.stay_discounts) ? room.stay_discounts : []) as unknown as StayDiscount[],
      })) as RoomUnit[];
    },
    enabled: !!profile?.organization_id,
    staleTime: 30000,
  });

  // Fetch bookings
  const {
    data: bookings = [],
    isLoading: bookingsLoading,
    refetch: refetchBookings,
  } = useQuery({
    queryKey: ['accommodation-bookings', profile?.organization_id, selectedPropertyId],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await (supabase as any)
        .from('bookings')
        .select(`
          *,
          room:room_units(name, price_per_night),
          lead:leads(id, name, email, phone, notes)
        `)
        .eq('organization_id', profile.organization_id)
        .eq(selectedPropertyId !== 'all' ? 'property_id' : 'organization_id', selectedPropertyId !== 'all' ? selectedPropertyId : profile.organization_id)
        .order('check_in', { ascending: true });

      if (error) throw error;

      return ((data || []) as any[]).map(booking => ({
        ...booking,
        room: booking.room as BookingWithRelations['room'],
        lead: booking.lead as BookingWithRelations['lead'],
        isExternal: false,
      })) as unknown as BookingWithRelations[];
    },
    enabled: !!profile?.organization_id,
    staleTime: 15000,
  });

  // Fetch leads without bookings (orphan leads for "New" column)
  const {
    data: orphanLeads = [],
    isLoading: orphanLeadsLoading,
    refetch: refetchOrphanLeads,
  } = useQuery({
    queryKey: ['accommodation-orphan-leads', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // Get all lead IDs that have bookings
      const { data: bookedLeadIds, error: bookingsError } = await supabase
        .from('bookings')
        .select('lead_id')
        .eq('organization_id', profile.organization_id);

      if (bookingsError) throw bookingsError;

      const leadIdsWithBookings = new Set((bookedLeadIds || []).map(b => b.lead_id));

      // Get all leads for the organization
      const { data: allLeads, error: leadsError } = await supabase
        .from('leads')
        .select('id, name, email, phone, created_at, source, notes')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      // Filter to only leads without bookings
      return (allLeads || []).filter(lead => !leadIdsWithBookings.has(lead.id));
    },
    enabled: !!profile?.organization_id,
    staleTime: 15000,
  });

  // Fetch ALL calendar sync events (for bookings tab - shows all external bookings)
  const {
    data: allCalendarEvents = [],
    isLoading: allCalendarEventsLoading,
    refetch: refetchAllCalendarEvents,
  } = useQuery({
    queryKey: ['accommodation-all-calendar-events', profile?.organization_id, selectedPropertyId],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // Fetch all events from 30 days ago to 1 year ahead
      const rangeStart = format(addDays(new Date(), -30), 'yyyy-MM-dd');
      const rangeEnd = format(addDays(new Date(), 365), 'yyyy-MM-dd');

      const { data, error } = await (supabase as any)
        .from('calendar_sync_events')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .gte('end_time', rangeStart)
        .lte('start_time', rangeEnd)
        .eq(selectedPropertyId !== 'all' ? 'property_id' : 'organization_id', selectedPropertyId !== 'all' ? selectedPropertyId : profile.organization_id)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as CalendarSyncEvent[];
    },
    enabled: !!profile?.organization_id,
    staleTime: 30000,
  });

  // Fetch calendar sync events for availability view (date-filtered for performance)
  const {
    data: calendarEvents = [],
    isLoading: calendarEventsLoading,
    refetch: refetchCalendarEvents,
  } = useQuery({
    queryKey: ['accommodation-calendar-events', profile?.organization_id, currentDate, viewMode, selectedPropertyId],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // Calculate date range based on view mode
      let rangeStart: Date;
      let rangeEnd: Date;

      if (viewMode === 'day') {
        rangeStart = currentDate;
        rangeEnd = currentDate;
      } else if (viewMode === 'week') {
        rangeStart = startOfWeek(currentDate);
        rangeEnd = endOfWeek(currentDate);
      } else {
        rangeStart = startOfWeek(startOfMonth(currentDate));
        rangeEnd = endOfWeek(endOfMonth(currentDate));
      }

      const startStr = format(rangeStart, 'yyyy-MM-dd');
      const endStr = format(rangeEnd, 'yyyy-MM-dd');

      const { data, error } = await (supabase as any)
        .from('calendar_sync_events')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .gte('end_time', startStr)
        .lte('start_time', endStr)
        .eq(selectedPropertyId !== 'all' ? 'property_id' : 'organization_id', selectedPropertyId !== 'all' ? selectedPropertyId : profile.organization_id);

      if (error) throw error;
      return (data || []) as unknown as CalendarSyncEvent[];
    },
    enabled: !!profile?.organization_id,
    staleTime: 30000,
  });

  // Helper function to convert calendar events to booking format
  const convertCalendarEventToBooking = useCallback((event: CalendarSyncEvent, roomsMap: Map<string, RoomUnit>): BookingWithRelations => {
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

    const room = roomsMap.get(event.room_unit_id);

    return {
      id: `external-${event.id}`,
      room_unit_id: event.room_unit_id,
      property_id: event.property_id,
      lead_id: '',
      check_in: checkInDate,
      check_out: checkOutDate,
      guest_count: event.guest_count || 1,
      status: 'external',
      notes: null,
      total_price: null,
      booking_source: event.source_platform || 'external',
      calendar_event_id: event.google_event_id,
      created_at: '',
      updated_at: '',
      isExternal: true,
      title: event.title || 'External Booking',
      room: room ? { name: room.name, price_per_night: room.price_per_night } : null,
      lead: { id: '', name: event.guest_name || event.title || 'External Booking', email: event.guest_email, phone: event.guest_phone, notes: null },
      guest_name: event.guest_name,
      guest_phone: event.guest_phone,
      guest_email: event.guest_email,
      source_platform: event.source_platform || 'unknown',
      calendar_name: event.calendar_name || 'External Calendar',
      raw_description: event.raw_description,
    };
  }, []);

  // Build a rooms map for efficient lookup
  const roomsMap = useMemo(() => new Map(rooms.map(r => [r.id, r])), [rooms]);

  // Build a set of linked calendar event keys
  const linkedEventKeys = useMemo(() => new Set(
    bookings
      .filter(b => b.calendar_event_id)
      .map(b => `${b.room_unit_id}:${b.calendar_event_id}`)
  ), [bookings]);

  // ALL bookings with external calendar events (for bookings tab)
  const allBookingsWithExternal = useMemo(() => {
    const externalBookings: BookingWithRelations[] = allCalendarEvents
      .filter(event => !linkedEventKeys.has(`${event.room_unit_id}:${event.google_event_id}`))
      .map(event => convertCalendarEventToBooking(event, roomsMap));

    return [...bookings, ...externalBookings];
  }, [bookings, allCalendarEvents, linkedEventKeys, convertCalendarEventToBooking, roomsMap]);

  // Combine bookings with external calendar events for availability view (date-filtered)
  const availabilityBookings = useMemo(() => {
    const externalBookings: BookingWithRelations[] = calendarEvents
      .filter(event => !linkedEventKeys.has(`${event.room_unit_id}:${event.google_event_id}`))
      .map(event => convertCalendarEventToBooking(event, roomsMap));

    return [...bookings, ...externalBookings];
  }, [bookings, calendarEvents, linkedEventKeys, convertCalendarEventToBooking, roomsMap]);

  const checkBookingOverlap = useCallback((roomId: string, checkIn: string, checkOut: string, excludeBookingId?: string): boolean => {
    return hasBookingOverlap(allBookingsWithExternal, roomId, checkIn, checkOut, excludeBookingId);
  }, [allBookingsWithExternal]);

  // Calendar days for availability view
  const calendarDays = useMemo(() => {
    if (viewMode === 'day') {
      return [currentDate];
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calStart = startOfWeek(monthStart);
      const calEnd = endOfWeek(monthEnd);
      return eachDayOfInterval({ start: calStart, end: calEnd });
    }
  }, [currentDate, viewMode]);

  // Filtered bookings based on filters
  const filteredBookings = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const weekEnd = format(addDays(today, 7), 'yyyy-MM-dd');
    const monthEnd = format(new Date(today.getFullYear(), today.getMonth() + 1, 0), 'yyyy-MM-dd');

    let filtered = [...bookings];

    // Status filter
    if (filters.statusFilter !== 'all') {
      filtered = filtered.filter(b => b.status === filters.statusFilter);
    }

    // Room filter
    if (filters.roomFilter !== 'all') {
      filtered = filtered.filter(b => b.room_unit_id === filters.roomFilter);
    }

    // Date filter
    switch (filters.dateFilter) {
      case 'today':
        filtered = filtered.filter(b =>
          b.check_in === todayStr ||
          b.check_out === todayStr ||
          (b.check_in <= todayStr && b.check_out >= todayStr)
        );
        break;
      case 'upcoming': {
        const sevenDaysAgo = format(addDays(today, -7), 'yyyy-MM-dd');
        filtered = filtered.filter(b =>
          (b.check_out >= todayStr && b.status !== 'cancelled') ||
          (b.status === 'checked_out' && b.check_out >= sevenDaysAgo)
        );
        break;
      }
      case 'past':
        filtered = filtered.filter(b => b.check_out < todayStr || b.status === 'checked_out');
        break;
      case 'this_week':
        filtered = filtered.filter(b => b.check_in >= todayStr && b.check_in <= weekEnd);
        break;
      case 'this_month':
        filtered = filtered.filter(b => b.check_in >= todayStr && b.check_in <= monthEnd);
        break;
      case 'custom':
        if (filters.customDateRange.from || filters.customDateRange.to) {
          const fromStr = filters.customDateRange.from ? format(filters.customDateRange.from, 'yyyy-MM-dd') : null;
          const toStr = filters.customDateRange.to ? format(filters.customDateRange.to, 'yyyy-MM-dd') : null;
          filtered = filtered.filter(b => {
            if (fromStr && toStr) {
              return b.check_in <= toStr && b.check_out >= fromStr;
            } else if (fromStr) {
              return b.check_out >= fromStr;
            } else if (toStr) {
              return b.check_in <= toStr;
            }
            return true;
          });
        }
        break;
    }

    // Search filter with scope
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      
      filtered = filtered.filter(b => {
        switch (filters.searchScope) {
          case 'guest':
            return b.lead?.name?.toLowerCase().includes(term) || 
                   b.guest_name?.toLowerCase().includes(term);
          
          case 'contact':
            return b.lead?.phone?.includes(term) ||
                   b.lead?.email?.toLowerCase().includes(term) ||
                   b.guest_phone?.includes(term) ||
                   b.guest_email?.toLowerCase().includes(term);
          
          case 'notes':
            return b.notes?.toLowerCase().includes(term) ||
                   b.raw_description?.toLowerCase().includes(term);
          
          case 'all':
          default:
            return b.lead?.name?.toLowerCase().includes(term) ||
                   b.guest_name?.toLowerCase().includes(term) ||
                   b.lead?.phone?.includes(term) ||
                   b.lead?.email?.toLowerCase().includes(term) ||
                   b.guest_phone?.includes(term) ||
                   b.guest_email?.toLowerCase().includes(term) ||
                   b.notes?.toLowerCase().includes(term) ||
                   b.raw_description?.toLowerCase().includes(term) ||
                   b.room?.name?.toLowerCase().includes(term);
        }
      });
    }

    // Sorting
    switch (filters.sortOption) {
      case 'check_in_asc':
        filtered.sort((a, b) => a.check_in.localeCompare(b.check_in));
        break;
      case 'check_in_desc':
        filtered.sort((a, b) => b.check_in.localeCompare(a.check_in));
        break;
      case 'created_at_desc':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'guest_name':
        filtered.sort((a, b) => (a.lead?.name || '').localeCompare(b.lead?.name || ''));
        break;
    }

    return filtered;
  }, [bookings, filters]);

  // Stats calculations
  const stats = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    return {
      pending: bookings.filter(b => b.status === 'pending').length,
      upcoming: bookings.filter(b => b.status === 'upcoming').length, // Renamed from confirmed
      checkedIn: bookings.filter(b => b.status === 'checked_in').length,
      arrivingToday: bookings.filter(b =>
        isToday(parseISO(b.check_in)) && ['pending', 'upcoming'].includes(b.status)
      ).length,
      departingToday: bookings.filter(b =>
        isToday(parseISO(b.check_out)) && b.status === 'checked_in'
      ).length,
      totalRooms: rooms.length,
      activeRooms: rooms.filter(r => r.is_active).length,
      occupiedToday: bookings.filter(b =>
        b.check_in <= todayStr && b.check_out > todayStr &&
        (b.status === 'checked_in' || b.status === 'upcoming')
      ).length,
      totalCapacity: rooms.filter(r => r.is_active).reduce((sum, r) => {
        const maxGuests = r.pricing_tiers.length > 0
          ? Math.max(...r.pricing_tiers.map(t => t.guests))
          : 0;
        return sum + maxGuests;
      }, 0),
      roomsWithCalendar: rooms.filter(r => r.calendar_ids && r.calendar_ids.length > 0).length,
      roomsWithoutCalendar: rooms.filter(r => r.is_active && (!r.calendar_ids || r.calendar_ids.length === 0)).length,
    };
  }, [bookings, rooms]);

  // Booking mutations
  const createBookingMutation = useMutation({
    mutationFn: async (data: {
      room_unit_id: string;
      lead_id: string;
      check_in: string;
      check_out: string;
      guest_count?: number;
      status?: string;
      notes?: string;
      total_price?: number;
      booking_source?: string;
    }) => {
      if (!profile?.organization_id) throw new Error('No organization');
      const room = rooms.find(r => r.id === data.room_unit_id);
      const propertyId = room?.property_id || getWritePropertyId();
      if (!propertyId) throw new Error('Select a property before creating a booking');
      const { data: result, error } = await supabase
        .from('bookings')
        .insert([{ ...data, organization_id: profile.organization_id, property_id: propertyId }])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accommodation-bookings'] });
      toast({ title: 'Booking Created', description: 'New booking has been added' });
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
            ? (error as { message: string }).message
            : 'Failed to create booking';

      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      devError('Create booking error:', error);
    },
  });

  const updateBookingMutation = useMutation({
    mutationFn: async (data: Partial<BookingWithRelations> & { id: string }) => {
      const { id, ...updateData } = data;
      if (updateData.room_unit_id) {
        const room = rooms.find(r => r.id === updateData.room_unit_id);
        if (room) {
          (updateData as any).property_id = room.property_id;
        }
      }
      const { data: result, error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accommodation-bookings'] });
      toast({ title: 'Booking Updated', description: 'Booking has been updated' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Failed to update booking', variant: 'destructive' });
      devError('Update booking error:', error);
    },
  });

  const deleteBookingMutation = useMutation({
    mutationFn: async (id: string): Promise<'archived' | 'direct'> => {
      const { error } = await (supabase as any).rpc('archive_booking_deletion', {
        _booking_id: id,
      });

      if (!error) return 'archived';
      devError('archive_booking_deletion failed, attempting direct delete fallback:', error);

      const { error: fallbackError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (fallbackError) throw fallbackError;
      return 'direct';
    },
    onSuccess: (mode) => {
      queryClient.invalidateQueries({ queryKey: ['accommodation-bookings'] });
      toast({
        title: 'Booking Deleted',
        description: mode === 'archived' ? 'Booking archived and recoverable for 5 hours' : 'Booking deleted successfully',
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to delete booking';
      toast({ title: 'Error', description: message, variant: 'destructive' });
      devError('Delete booking error:', error);
    },
  });

  // Room mutations
  const createRoomMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string | null;
      is_active?: boolean;
      calendar_ids?: string[];
      calendar_sources?: Json;
      amenities?: Json;
      image_url?: string | null;
      pricing_tiers?: Json;
      stay_discounts?: Json;
      category?: string | null;
    }) => {
      if (!profile?.organization_id) throw new Error('No organization');
      const propertyId = getWritePropertyId();
      if (!propertyId) throw new Error('Select a property before creating a room');
      const { data: result, error } = await supabase
        .from('room_units')
        .insert([{ ...data, organization_id: profile.organization_id, property_id: propertyId }])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accommodation-rooms'] });
      toast({ title: 'Room Created', description: 'New room has been added' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Failed to create room', variant: 'destructive' });
      devError('Create room error:', error);
    },
  });

  const updateRoomMutation = useMutation({
    mutationFn: async (data: { id: string } & {
      name?: string;
      description?: string | null;
      is_active?: boolean;
      calendar_ids?: string[];
      calendar_sources?: Json;
      amenities?: Json;
      image_url?: string | null;
      pricing_tiers?: Json;
      stay_discounts?: Json;
      category?: string | null;
      display_order?: number;
    }) => {
      const { id, ...updateData } = data;
      const { data: result, error } = await supabase
        .from('room_units')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accommodation-rooms'] });
      toast({ title: 'Room Updated', description: 'Room has been updated' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: 'Failed to update room', variant: 'destructive' });
      devError('Update room error:', error);
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: async (id: string): Promise<'archived' | 'direct'> => {
      const { error } = await (supabase as any).rpc('archive_room_deletion', {
        _room_id: id,
      });

      if (!error) return 'archived';
      devError('archive_room_deletion failed, attempting direct delete fallback:', error);

      const { error: fallbackError } = await supabase
        .from('room_units')
        .delete()
        .eq('id', id);

      if (fallbackError) throw fallbackError;
      return 'direct';
    },
    onSuccess: (mode) => {
      queryClient.invalidateQueries({ queryKey: ['accommodation-rooms'] });
      toast({
        title: 'Room Deleted',
        description: mode === 'archived' ? 'Room archived and recoverable for 5 hours' : 'Room deleted successfully',
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to delete room';
      toast({ title: 'Error', description: message, variant: 'destructive' });
      devError('Delete room error:', error);
    },
  });

  // Real-time subscriptions
  useEffect(() => {
    if (!profile?.organization_id) return;

    const channel = supabase
      .channel('accommodation-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `organization_id=eq.${profile.organization_id}` },
        () => refetchBookings()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_units', filter: `organization_id=eq.${profile.organization_id}` },
        () => refetchRooms()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_sync_events', filter: `organization_id=eq.${profile.organization_id}` },
        () => {
          refetchCalendarEvents();
          refetchAllCalendarEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.organization_id, refetchBookings, refetchRooms, refetchCalendarEvents, refetchAllCalendarEvents]);

  // Helper functions
  const updateFilters = useCallback((newFilters: Partial<AccommodationFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const refetchAll = useCallback(async () => {
    await Promise.all([refetchBookings(), refetchRooms(), refetchCalendarEvents(), refetchAllCalendarEvents(), refetchOrphanLeads()]);
  }, [refetchBookings, refetchRooms, refetchCalendarEvents, refetchAllCalendarEvents, refetchOrphanLeads]);

  const getRoomPricing = useCallback((roomId: string): RoomUnit | null => {
    return rooms.find(r => r.id === roomId) || null;
  }, [rooms]);

  return {
    // Data
    properties,
    rooms,
    bookings,
    allBookingsWithExternal,
    filteredBookings,
    availabilityBookings,
    calendarEvents,
    allCalendarEvents,
    calendarDays,
    stats,
    orphanLeads,
    
    // Loading states
    isLoading: roomsLoading || bookingsLoading || propertiesLoading,
    propertiesLoading,
    roomsLoading,
    bookingsLoading,
    calendarEventsLoading,
    allCalendarEventsLoading,
    orphanLeadsLoading,
    
    // Filters
    selectedPropertyId,
    setSelectedPropertyId,
    filters,
    updateFilters,
    resetFilters,
    
    // Availability view state
    currentDate,
    setCurrentDate,
    viewMode,
    setViewMode,
    
    // Mutations
    createBooking: createBookingMutation.mutate,
    updateBooking: updateBookingMutation.mutate,
    deleteBooking: deleteBookingMutation.mutate,
    createRoom: createRoomMutation.mutate,
    updateRoom: updateRoomMutation.mutate,
    deleteRoom: deleteRoomMutation.mutate,
    
    // Mutation states
    isCreatingBooking: createBookingMutation.isPending,
    isUpdatingBooking: updateBookingMutation.isPending,
    isDeletingBooking: deleteBookingMutation.isPending,
    isCreatingRoom: createRoomMutation.isPending,
    isUpdatingRoom: updateRoomMutation.isPending,
    isDeletingRoom: deleteRoomMutation.isPending,
    
    // Helpers
    refetchAll,
    getRoomPricing,
    checkBookingOverlap,
  };
}
