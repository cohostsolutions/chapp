import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { LeadRow } from '@/types/database';

interface OfferingRow {
  id: string;
  name: string;
  price: number | null;
  category: string | null;
  description?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  is_active: boolean;
  display_order?: number | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

interface SalesStats {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  lostLeads: number;
  totalOfferings: number;
  leadsWithOfferings: number;
  upcomingEvents: number;
  requestedAppointments: number;
  confirmedAppointments: number;
  aiBookedAppointments: number;
  manualConfirmedAppointments: number;
}

interface LeadWithOfferings extends LeadRow {
  offerings?: OfferingRow[];
  upcoming_appointments?: { count: number };
}

export interface CalendarSyncEvent {
  id: string;
  google_event_id: string;
  calendar_id: string;
  calendar_name: string | null;
  room_unit_id: string;
  organization_id: string;
  title: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean | null;
  status: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  guest_count: number | null;
  source_platform: string | null;
  raw_description: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface InternalCalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean;
  event_type: string | null;
  location: string | null;
  organization_id: string;
  user_id: string | null;
  related_lead_id: string | null;
  related_order_id: string | null;
  related_booking_id: string | null;
  external_calendar_id: string | null;
  metadata: Record<string, unknown> | null;
  appointment_status?: 'requested' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | null;
  appointment_source?: 'manual' | 'jay_ai' | 'external_sync' | null;
  created_at: string;
  updated_at: string;
}

interface SalesDataHook {
  leads: LeadWithOfferings[];
  offerings: OfferingRow[];
  calendarEvents: InternalCalendarEvent[];
  syncedEvents: CalendarSyncEvent[];
  stats: SalesStats;
  isLoading: boolean;
  refetchAll: () => Promise<void>;
}

export function useSalesData(): SalesDataHook {
  const { profile } = useAuth();

  // Fetch leads with their associated offerings
  const leadsQuery = useQuery({
    queryKey: ['jay-leads', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // Note: lead_offerings table doesn't exist yet - just fetch leads
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Return leads with empty offerings array (lead_offerings table not implemented)
      return (data || []).map(lead => ({
        ...lead,
        offerings: [] as OfferingRow[],
      })) as LeadWithOfferings[];
    },
    enabled: !!profile?.organization_id,
    staleTime: 30000,
  });

  // Fetch offerings (both active and inactive for management)
  const offeringsQuery = useQuery({
    queryKey: ['jay-offerings', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('offerings')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('display_order');

      if (error) throw error;
      return (data || []) as OfferingRow[];
    },
    enabled: !!profile?.organization_id,
    staleTime: 30000,
  });

  // Fetch calendar events for appointments
  const appointmentsQuery = useQuery({
    queryKey: ['jay-appointments', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('calendar_sync_events')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return (data || []);
    },
    enabled: !!profile?.organization_id,
    staleTime: 30000,
  });

  // Fetch internal calendar events
  const calendarEventsQuery = useQuery({
    queryKey: ['jay-calendar-events', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return (data || []);
    },
    enabled: !!profile?.organization_id,
    staleTime: 30000,
  });

  const leads = leadsQuery.data || [];
  const offerings = offeringsQuery.data || [];
  const calendarEvents = calendarEventsQuery.data || [];
  const syncedEvents = appointmentsQuery.data || [];

  // Count upcoming events (from today onwards)
  const now = new Date();
  const upcomingInternalEvents = calendarEvents.filter(e => new Date(e.start_time) >= now).length;
  const upcomingSyncedEvents = syncedEvents.filter(e => new Date(e.start_time) >= now).length;
  const requestedAppointments = calendarEvents.filter((event) => event.appointment_status === 'requested').length;
  const confirmedAppointments = calendarEvents.filter((event) => event.appointment_status === 'confirmed').length;
  const aiBookedAppointments = calendarEvents.filter((event) => event.appointment_source === 'jay_ai' && event.appointment_status !== 'cancelled' && event.appointment_status !== 'no_show').length;
  const manualConfirmedAppointments = calendarEvents.filter((event) => event.appointment_source !== 'jay_ai' && event.appointment_status === 'confirmed').length;

  const stats: SalesStats = {
    totalLeads: leads.length,
    newLeads: leads.filter(l => l.status === 'new').length,
    qualifiedLeads: leads.filter(l => l.status === 'qualified').length,
    convertedLeads: leads.filter(l => l.status === 'converted').length,
    lostLeads: leads.filter(l => l.status === 'lost').length,
    totalOfferings: offerings.length,
    leadsWithOfferings: leads.filter(l => l.offerings && l.offerings.length > 0).length,
    upcomingEvents: upcomingInternalEvents + upcomingSyncedEvents,
    requestedAppointments,
    confirmedAppointments,
    aiBookedAppointments,
    manualConfirmedAppointments,
  };

  const isLoading = leadsQuery.isLoading || offeringsQuery.isLoading || calendarEventsQuery.isLoading;

  const refetchAll = async () => {
    await Promise.all([
      leadsQuery.refetch(),
      offeringsQuery.refetch(),
      calendarEventsQuery.refetch(),
      appointmentsQuery.refetch(),
    ]);
  };

  return {
    leads,
    offerings,
    calendarEvents: calendarEvents as InternalCalendarEvent[],
    syncedEvents: syncedEvents as CalendarSyncEvent[],
    stats,
    isLoading,
    refetchAll,
  };
}
