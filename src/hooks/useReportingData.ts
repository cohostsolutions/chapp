import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfMonth, subMonths, format, startOfDay, subDays, differenceInDays } from 'date-fns';
import { useCallback, useEffect } from 'react';
import { resolveReportingDateRange, useReportingFilters } from '@/contexts/ReportingFiltersContext';

type QueryWithDateRange = {
  gte: (column: string, value: string) => QueryWithDateRange;
  lte: (column: string, value: string) => QueryWithDateRange;
};

function applyDateRange(query: QueryWithDateRange, column: string, start: Date | null, end: Date | null): QueryWithDateRange {
  let nextQuery = query;
  if (start) {
    nextQuery = nextQuery.gte(column, start.toISOString());
  }
  if (end) {
    nextQuery = nextQuery.lte(column, end.toISOString());
  }
  return nextQuery;
}

export interface LeadConversionData {
  status: string;
  count: number;
  percentage: number;
}

export interface LeadSourceData {
  source: string;
  count: number;
  percentage: number;
}

export interface SalesPerformanceData {
  date: string;
  orders: number;
  revenue: number;
  bookings: number;
  meetings: number;
  aiBookedAppointments: number;
  leads: number;
  closedLeads: number;
}

export interface LeadTemperatureData {
  temperature: string;
  count: number;
  percentage: number;
}

export interface AgentPerformanceData {
  agentId: string;
  agentName: string;
  leadsAssigned: number;
  leadsConverted: number;
  conversionRate: number;
}

export interface BookingSourceData {
  source: string;
  count: number;
  percentage: number;
}

export interface ReportingSummary {
  totalLeads: number;
  newLeadsThisMonth: number;
  conversionRate: number;
  totalRevenue: number;
  revenueThisMonth: number;
  totalOrders: number;
  ordersThisMonth: number;
  averageOrderValue: number;
  completedOrders: number;
  orderCompletionRate: number;
  totalBookings: number;
  bookingsThisMonth: number;
  confirmedBookings: number;
  bookingConfirmationRate: number;
  totalMeetings: number;
  meetingsThisMonth: number;
  totalAIBookedAppointments: number;
  aiBookedAppointmentsThisMonth: number;
  totalExpenses: number;
  expensesThisMonth: number;
  pendingExpenses: number;
}

export function useReportingSummary() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const filters = useReportingFilters();
  const resolvedDateRange = resolveReportingDateRange(filters);

  const invalidateReportingQueries = useCallback(() => {
    if (!profile?.organization_id) return;

    const organizationId = profile.organization_id;

    queryClient.invalidateQueries({ queryKey: ['reporting-summary', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['lead-conversion-data', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['lead-source-data', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['lead-temperature-data', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['sales-performance-data', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['agent-performance-data', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['booking-source-data', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['order-status-chart', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['booking-status-chart', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['room-occupancy', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['menu-performance', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['reporting-expenses', organizationId] });
  }, [profile?.organization_id, queryClient]);

  // Set up real-time subscriptions for reporting data
  useEffect(() => {
    if (!profile?.organization_id) return;

    const channel = supabase
      .channel('reporting-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        invalidateReportingQueries
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        invalidateReportingQueries
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        invalidateReportingQueries
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_units' },
        invalidateReportingQueries
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'operational_expenses' },
        invalidateReportingQueries
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
        invalidateReportingQueries
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [invalidateReportingQueries, profile?.organization_id]);

  return useQuery({
    queryKey: ['reporting-summary', profile?.organization_id, filters.dateRange, filters.startDate, filters.endDate],
    queryFn: async (): Promise<ReportingSummary> => {
      if (!profile?.organization_id) throw new Error('No organization');

      const monthStart = resolvedDateRange.start?.toISOString() || startOfMonth(new Date()).toISOString();

      // Fetch leads
      const leadsQuery = applyDateRange(
        supabase
        .from('leads')
        .select('id, status, created_at')
        .eq('organization_id', profile.organization_id),
        'created_at',
        resolvedDateRange.start,
        resolvedDateRange.end,
      );

      const { data: leads, error: leadsError } = await leadsQuery;

      if (leadsError) throw leadsError;

      const totalLeads = leads?.length || 0;
      const newLeadsThisMonth = leads?.filter(l => l.created_at >= monthStart).length || 0;
      const convertedLeads = leads?.filter(l => l.status === 'converted').length || 0;
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

      // Fetch orders with revenue
      const ordersQuery = applyDateRange(
        supabase
        .from('orders')
        .select('id, total_amount, created_at, status')
        .eq('organization_id', profile.organization_id),
        'created_at',
        resolvedDateRange.start,
        resolvedDateRange.end,
      );

      const { data: orders, error: ordersError } = await ordersQuery;

      if (ordersError) throw ordersError;

      const orderRevenue = orders?.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) || 0;
      const ordersThisMonth = orders?.filter(o => o.created_at >= monthStart) || [];
      const orderRevenueThisMonth = ordersThisMonth.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      const completedOrders = orders?.filter(o => o.status === 'completed').length || 0;
      const averageOrderValue = (orders?.length || 0) > 0 ? orderRevenue / (orders?.length || 1) : 0;
      const orderCompletionRate = (orders?.length || 0) > 0 ? (completedOrders / (orders?.length || 1)) * 100 : 0;

      // Fetch bookings with total_price (includes manual price overrides)
      const bookingsQuery = applyDateRange(
        supabase
        .from('bookings')
        .select('id, created_at, check_in, check_out, room_unit_id, status, total_price')
        .eq('organization_id', profile.organization_id),
        'created_at',
        resolvedDateRange.start,
        resolvedDateRange.end,
      );

      const { data: bookings, error: bookingsError } = await bookingsQuery;

      if (bookingsError) throw bookingsError;

      // Fetch room units to get prices (fallback for bookings without total_price)
      const { data: roomUnits, error: roomUnitsError } = await supabase
        .from('room_units')
        .select('id, price_per_night')
        .eq('organization_id', profile.organization_id);

      if (roomUnitsError) throw roomUnitsError;

      // Create a map of room unit prices for fallback calculation
      const roomPrices: Record<string, number> = {};
      roomUnits?.forEach(room => {
        roomPrices[room.id] = Number(room.price_per_night) || 0;
      });

      // Calculate booking revenue
      // Use total_price if available (includes manual overrides), otherwise calculate from room rate
      const revenueStatuses = ['confirmed', 'upcoming', 'checked_in', 'checked_out', 'completed'];
      let bookingRevenue = 0;
      let bookingRevenueThisMonth = 0;

      bookings?.forEach(booking => {
        if (!revenueStatuses.includes(booking.status)) return;
        
        // Use stored total_price if available (manual override or calculated), otherwise fallback to room rate calculation
        let revenue: number;
        if (booking.total_price != null) {
          revenue = Number(booking.total_price);
        } else {
          // Fallback: calculate from room rate × nights
          const pricePerNight = roomPrices[booking.room_unit_id] || 0;
          const checkIn = new Date(booking.check_in);
          const checkOut = new Date(booking.check_out);
          const nights = Math.max(1, differenceInDays(checkOut, checkIn));
          revenue = pricePerNight * nights;
        }
        
        bookingRevenue += revenue;
        
        if (booking.created_at >= monthStart) {
          bookingRevenueThisMonth += revenue;
        }
      });

      // Total revenue = order revenue + booking revenue
      const totalRevenue = orderRevenue + bookingRevenue;
      const revenueThisMonth = orderRevenueThisMonth + bookingRevenueThisMonth;

      const bookingsThisMonthCount = bookings?.filter(b => b.created_at >= monthStart).length || 0;
      const confirmedBookingStatuses = ['confirmed', 'upcoming', 'checked_in', 'checked_out', 'completed'];
      const confirmedBookings = bookings?.filter(b => confirmedBookingStatuses.includes(b.status)).length || 0;
      const bookingConfirmationRate = (bookings?.length || 0) > 0 ? (confirmedBookings / (bookings?.length || 1)) * 100 : 0;

      // Fetch calendar events used as meetings / scheduled follow-ups
      const meetingsQuery = applyDateRange(
        supabase
        .from('calendar_events')
        .select('id, created_at, appointment_source')
        .eq('organization_id', profile.organization_id),
        'created_at',
        resolvedDateRange.start,
        resolvedDateRange.end,
      );

      const { data: meetings, error: meetingsError } = await meetingsQuery;

      if (meetingsError) throw meetingsError;

      const totalMeetings = meetings?.length || 0;
      const meetingsThisMonth = meetings?.filter(m => m.created_at >= monthStart).length || 0;
      const totalAIBookedAppointments = meetings?.filter(m => m.appointment_source === 'jay_ai').length || 0;
      const aiBookedAppointmentsThisMonth = meetings?.filter(m => m.appointment_source === 'jay_ai' && m.created_at >= monthStart).length || 0;

      // Fetch operational expenses
      const expensesQuery = applyDateRange(
        supabase
        .from('operational_expenses')
        .select('id, amount, is_paid, expense_date')
        .eq('organization_id', profile.organization_id),
        'expense_date',
        resolvedDateRange.start,
        resolvedDateRange.end,
      );

      const { data: expenses, error: expensesError } = await expensesQuery;

      if (expensesError) throw expensesError;

      const totalExpenses = expenses?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
      const expensesThisMonth = expenses
        ?.filter(e => e.expense_date >= monthStart.split('T')[0])
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
      const pendingExpenses = expenses
        ?.filter(e => !e.is_paid)
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;

      return {
        totalLeads,
        newLeadsThisMonth,
        conversionRate,
        totalRevenue,
        revenueThisMonth,
        totalOrders: orders?.length || 0,
        ordersThisMonth: ordersThisMonth.length,
        averageOrderValue,
        completedOrders,
        orderCompletionRate,
        totalBookings: bookings?.length || 0,
        bookingsThisMonth: bookingsThisMonthCount,
        confirmedBookings,
        bookingConfirmationRate,
        totalMeetings,
        meetingsThisMonth,
        totalAIBookedAppointments,
        aiBookedAppointmentsThisMonth,
        totalExpenses,
        expensesThisMonth,
        pendingExpenses,
      };
    },
    enabled: !!profile?.organization_id,
    staleTime: 30 * 1000, // Reduced stale time for more frequent updates
  });
}

export function useLeadConversionData() {
  const { profile } = useAuth();
  const filters = useReportingFilters();
  const resolvedDateRange = resolveReportingDateRange(filters);

  return useQuery({
    queryKey: ['lead-conversion-data', profile?.organization_id, filters.dateRange, filters.startDate, filters.endDate, filters.selectedAgent],
    queryFn: async (): Promise<LeadConversionData[]> => {
      if (!profile?.organization_id) throw new Error('No organization');

      let query = applyDateRange(
        supabase
        .from('leads')
        .select('status, assigned_agent_id, created_at')
        .eq('organization_id', profile.organization_id),
        'created_at',
        resolvedDateRange.start,
        resolvedDateRange.end,
      );

      if (filters.selectedAgent !== 'all') {
        query = query.eq('assigned_agent_id', filters.selectedAgent);
      }

      const { data: leads, error } = await query;

      if (error) throw error;

      const total = leads?.length || 0;
      const statusCounts = leads?.reduce((acc: Record<string, number>, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
      }, {}) || {};

      const statusLabels: Record<string, string> = {
        new: 'New',
        contacted: 'Contacted',
        qualified: 'Qualified',
        proposal: 'Proposal',
        negotiation: 'Negotiation',
        converted: 'Converted',
        lost: 'Lost',
      };

      return Object.entries(statusCounts).map(([status, count]) => ({
        status: statusLabels[status] || status,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }));
    },
    enabled: !!profile?.organization_id,
    staleTime: 2 * 60 * 1000,
  });
}

export function useLeadSourceData() {
  const { profile } = useAuth();
  const filters = useReportingFilters();
  const resolvedDateRange = resolveReportingDateRange(filters);

  return useQuery({
    queryKey: ['lead-source-data', profile?.organization_id, filters.dateRange, filters.startDate, filters.endDate, filters.selectedAgent],
    queryFn: async (): Promise<LeadSourceData[]> => {
      if (!profile?.organization_id) throw new Error('No organization');

      let query = applyDateRange(
        supabase
        .from('leads')
        .select('source, assigned_agent_id, created_at')
        .eq('organization_id', profile.organization_id),
        'created_at',
        resolvedDateRange.start,
        resolvedDateRange.end,
      );

      if (filters.selectedAgent !== 'all') {
        query = query.eq('assigned_agent_id', filters.selectedAgent);
      }

      const { data: leads, error } = await query;

      if (error) throw error;

      const total = leads?.length || 0;
      const sourceCounts = leads?.reduce((acc: Record<string, number>, lead) => {
        const source = lead.source || 'Unknown';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {}) || {};

      return Object.entries(sourceCounts)
        .map(([source, count]) => ({
          source,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);
    },
    enabled: !!profile?.organization_id,
    staleTime: 2 * 60 * 1000,
  });
}

export function useLeadTemperatureData() {
  const { profile } = useAuth();
  const filters = useReportingFilters();
  const resolvedDateRange = resolveReportingDateRange(filters);

  return useQuery({
    queryKey: ['lead-temperature-data', profile?.organization_id, filters.dateRange, filters.startDate, filters.endDate, filters.selectedAgent],
    queryFn: async (): Promise<LeadTemperatureData[]> => {
      if (!profile?.organization_id) throw new Error('No organization');

      let query = applyDateRange(
        supabase
        .from('leads')
        .select('lead_temperature, assigned_agent_id, created_at')
        .eq('organization_id', profile.organization_id),
        'created_at',
        resolvedDateRange.start,
        resolvedDateRange.end,
      );

      if (filters.selectedAgent !== 'all') {
        query = query.eq('assigned_agent_id', filters.selectedAgent);
      }

      const { data: leads, error } = await query;

      if (error) throw error;

      const total = leads?.length || 0;
      const tempCounts = leads?.reduce((acc: Record<string, number>, lead) => {
        const temp = lead.lead_temperature || 'cold';
        acc[temp] = (acc[temp] || 0) + 1;
        return acc;
      }, {}) || {};

      const tempLabels: Record<string, string> = {
        hot: 'Hot',
        warm: 'Warm',
        cold: 'Cold',
      };

      return Object.entries(tempCounts).map(([temp, count]) => ({
        temperature: tempLabels[temp] || temp,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }));
    },
    enabled: !!profile?.organization_id,
    staleTime: 2 * 60 * 1000,
  });
}

export function useSalesPerformanceData(days: number = 30) {
  const { profile } = useAuth();
  const filters = useReportingFilters();
  const resolvedDateRange = resolveReportingDateRange(filters);

  return useQuery({
    queryKey: ['sales-performance-data', profile?.organization_id, days, filters.dateRange, filters.startDate, filters.endDate, filters.selectedAgent],
    queryFn: async (): Promise<SalesPerformanceData[]> => {
      if (!profile?.organization_id) throw new Error('No organization');

      const startDate = resolvedDateRange.start?.toISOString() || startOfDay(subDays(new Date(), days)).toISOString();
      const endDate = resolvedDateRange.end?.toISOString() || null;

      // Fetch orders
      let ordersQuery = supabase
        .from('orders')
        .select('id, total_amount, created_at')
        .eq('organization_id', profile.organization_id)
        .gte('created_at', startDate);

      if (endDate) {
        ordersQuery = ordersQuery.lte('created_at', endDate);
      }

      const { data: orders, error: ordersError } = await ordersQuery;

      if (ordersError) throw ordersError;

      // Fetch bookings
      let bookingsQuery = supabase
        .from('bookings')
        .select('id, created_at')
        .eq('organization_id', profile.organization_id)
        .gte('created_at', startDate);

      if (endDate) {
        bookingsQuery = bookingsQuery.lte('created_at', endDate);
      }

      const { data: bookings, error: bookingsError } = await bookingsQuery;

      if (bookingsError) throw bookingsError;

      // Fetch leads
      let leadsQuery = supabase
        .from('leads')
        .select('id, created_at, status, assigned_agent_id')
        .eq('organization_id', profile.organization_id)
        .gte('created_at', startDate);

      if (endDate) {
        leadsQuery = leadsQuery.lte('created_at', endDate);
      }
      if (filters.selectedAgent !== 'all') {
        leadsQuery = leadsQuery.eq('assigned_agent_id', filters.selectedAgent);
      }

      const { data: leads, error: leadsError } = await leadsQuery;

      if (leadsError) throw leadsError;

      // Fetch calendar events (meetings)
      let eventsQuery = supabase
        .from('calendar_events')
        .select('id, created_at, start_time, appointment_source')
        .eq('organization_id', profile.organization_id)
        .gte('created_at', startDate);

      if (endDate) {
        eventsQuery = eventsQuery.lte('created_at', endDate);
      }

      const { data: events, error: eventsError } = await eventsQuery;

      if (eventsError) throw eventsError;

      // Group by date
      const dailyData: Record<string, { orders: number; revenue: number; bookings: number; meetings: number; aiBookedAppointments: number; leads: number; closedLeads: number }> = {};

      // Initialize all dates
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd');
        dailyData[date] = { orders: 0, revenue: 0, bookings: 0, meetings: 0, aiBookedAppointments: 0, leads: 0, closedLeads: 0 };
      }

      // Aggregate orders
      orders?.forEach(order => {
        const date = format(new Date(order.created_at), 'yyyy-MM-dd');
        if (dailyData[date]) {
          dailyData[date].orders += 1;
          dailyData[date].revenue += Number(order.total_amount) || 0;
        }
      });

      // Aggregate bookings
      bookings?.forEach(booking => {
        const date = format(new Date(booking.created_at), 'yyyy-MM-dd');
        if (dailyData[date]) {
          dailyData[date].bookings += 1;
        }
      });

      // Aggregate leads
      leads?.forEach(lead => {
        const date = format(new Date(lead.created_at), 'yyyy-MM-dd');
        if (dailyData[date]) {
          dailyData[date].leads += 1;
          if (lead.status === 'converted') {
            dailyData[date].closedLeads += 1;
          }
        }
      });

      // Aggregate meetings (calendar events)
      events?.forEach(event => {
        const date = format(new Date(event.start_time || event.created_at), 'yyyy-MM-dd');
        if (dailyData[date]) {
          dailyData[date].meetings += 1;
          if (event.appointment_source === 'jay_ai') {
            dailyData[date].aiBookedAppointments += 1;
          }
        }
      });

      return Object.entries(dailyData).map(([date, data]) => ({
        date: format(new Date(date), 'MMM d'),
        ...data,
      }));
    },
    enabled: !!profile?.organization_id,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAgentPerformanceData() {
  const { profile } = useAuth();
  const filters = useReportingFilters();
  const resolvedDateRange = resolveReportingDateRange(filters);

  return useQuery({
    queryKey: ['agent-performance-data', profile?.organization_id, filters.dateRange, filters.startDate, filters.endDate, filters.selectedAgent],
    queryFn: async (): Promise<AgentPerformanceData[]> => {
      if (!profile?.organization_id) throw new Error('No organization');

      // Fetch agents in the organization
      let agentsQuery = supabase
        .from('profiles')
        .select('id, full_name')
        .eq('organization_id', profile.organization_id);

      if (filters.selectedAgent !== 'all') {
        agentsQuery = agentsQuery.eq('id', filters.selectedAgent);
      }

      const { data: agents, error: agentsError } = await agentsQuery;

      if (agentsError) throw agentsError;

      // Fetch leads with assigned agents
      let leadsQuery = applyDateRange(
        supabase
        .from('leads')
        .select('id, status, assigned_agent_id, created_at')
        .eq('organization_id', profile.organization_id)
        .not('assigned_agent_id', 'is', null),
        'created_at',
        resolvedDateRange.start,
        resolvedDateRange.end,
      );

      if (filters.selectedAgent !== 'all') {
        leadsQuery = leadsQuery.eq('assigned_agent_id', filters.selectedAgent);
      }

      const { data: leads, error: leadsError } = await leadsQuery;

      if (leadsError) throw leadsError;

      // Calculate agent performance
      const agentStats: Record<string, { assigned: number; converted: number }> = {};

      leads?.forEach(lead => {
        if (!lead.assigned_agent_id) return;
        if (!agentStats[lead.assigned_agent_id]) {
          agentStats[lead.assigned_agent_id] = { assigned: 0, converted: 0 };
        }
        agentStats[lead.assigned_agent_id].assigned += 1;
        if (lead.status === 'converted') {
          agentStats[lead.assigned_agent_id].converted += 1;
        }
      });

      return agents?.map(agent => {
        const stats = agentStats[agent.id] || { assigned: 0, converted: 0 };
        return {
          agentId: agent.id,
          agentName: agent.full_name || 'Unknown',
          leadsAssigned: stats.assigned,
          leadsConverted: stats.converted,
          conversionRate: stats.assigned > 0 ? (stats.converted / stats.assigned) * 100 : 0,
        };
      }).filter(a => a.leadsAssigned > 0).sort((a, b) => b.conversionRate - a.conversionRate) || [];
    },
    enabled: !!profile?.organization_id,
    staleTime: 2 * 60 * 1000,
  });
}

export function useBookingSourceData() {
  const { profile } = useAuth();
  const filters = useReportingFilters();
  const resolvedDateRange = resolveReportingDateRange(filters);

  return useQuery({
    queryKey: ['booking-source-data', profile?.organization_id, filters.dateRange, filters.startDate, filters.endDate],
    queryFn: async (): Promise<BookingSourceData[]> => {
      if (!profile?.organization_id) throw new Error('No organization');

      // Fetch bookings with calendar_sync_events and room_units for accurate source mapping
      const query = applyDateRange(
        supabase
        .from('bookings')
        .select(`
          id,
          booking_source,
          calendar_event_id,
          room_unit_id,
          created_at,
          room_units!bookings_room_unit_id_fkey(calendar_sources)
        `)
        .eq('organization_id', profile.organization_id),
        'created_at',
        resolvedDateRange.start,
        resolvedDateRange.end,
      );

      const { data: bookings, error } = await query;

      if (error) throw error;

      // Batch-fetch all needed calendar_sync_events in a single query (avoids N+1)
      const calendarEventIds = (bookings || [])
        .filter(b => ['calendar', 'google'].includes(b.booking_source || '') && b.calendar_event_id)
        .map(b => b.calendar_event_id as string);

      const syncEventMap = new Map<string, { calendar_id: string | null; source_platform: string | null }>();
      if (calendarEventIds.length > 0) {
        const { data: syncEvents } = await supabase
          .from('calendar_sync_events')
          .select('google_event_id, calendar_id, source_platform')
          .in('google_event_id', calendarEventIds);
        for (const se of syncEvents || []) {
          syncEventMap.set(se.google_event_id, { calendar_id: se.calendar_id, source_platform: se.source_platform });
        }
      }

      // For each booking, resolve the actual source using the pre-fetched map
      const resolvedSources: string[] = [];

      for (const booking of bookings || []) {
        let resolvedSource = booking.booking_source || 'unknown';

        if (['calendar', 'google'].includes(resolvedSource) && booking.calendar_event_id && booking.room_unit_id) {
          const syncEvent = syncEventMap.get(booking.calendar_event_id);

          if (syncEvent?.source_platform && !['calendar', 'google', 'unknown'].includes(syncEvent.source_platform)) {
            resolvedSource = syncEvent.source_platform;
          } else if (syncEvent?.calendar_id) {
            const roomUnit = booking.room_units as { calendar_sources?: Record<string, string> } | null;
            const calendarSources = roomUnit?.calendar_sources || {};
            if (calendarSources[syncEvent.calendar_id]) {
              resolvedSource = calendarSources[syncEvent.calendar_id];
            }
          }
        }

        resolvedSources.push(resolvedSource);
      }

      const total = resolvedSources.length;
      const sourceCounts = resolvedSources.reduce((acc: Record<string, number>, source) => {
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(sourceCounts)
        .map(([source, count]) => ({
          source,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);
    },
    enabled: !!profile?.organization_id,
    staleTime: 2 * 60 * 1000,
  });
}
