import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { OrderRow, LeadRow } from '@/types/database';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  category: string | null;
  image_url: string | null;
  is_active: boolean;
}

interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  preparingOrders: number;
  readyOrders: number;
  totalMenuItems: number;
  averageOrderValue: number;
  upcomingEvents: number;
}

interface OrderWithLead extends OrderRow {
  lead?: Pick<LeadRow, 'id' | 'name' | 'email' | 'phone'> | null;
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
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface PrepConfig {
  id: string;
  organization_id: string;
  menu_item_id: string;
  prep_duration_days: number;
  reminder_offset_days: number;
  buffer_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PrepTask {
  id: string;
  organization_id: string;
  order_id: string;
  task_key: string;
  menu_item_id: string | null;
  prep_item_name: string;
  quantity: number;
  prep_duration_days: number;
  scheduled_start_time: string | null;
  scheduled_ready_time: string | null;
  reminder_time: string | null;
  status: 'scheduled' | 'in_progress' | 'ready' | 'completed' | 'cancelled';
  manual_override: boolean;
  override_notes: string | null;
  overridden_by: string | null;
  created_at: string;
  updated_at: string;
}

interface OrdersDataHook {
  orders: OrderWithLead[];
  menuItems: MenuItem[];
  calendarEvents: InternalCalendarEvent[];
  syncedEvents: CalendarSyncEvent[];
  prepConfigs: PrepConfig[];
  prepTasks: PrepTask[];
  stats: OrderStats;
  isLoading: boolean;
  refetchAll: () => Promise<void>;
}

export function useOrdersData(): OrdersDataHook {
  const { profile } = useAuth();

  // Fetch orders with lead information
  const ordersQuery = useQuery({
    queryKey: ['may-orders', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          lead:leads(id, name, email, phone)
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(order => ({
        ...order,
        lead: order.lead as OrderWithLead['lead'],
      })) as OrderWithLead[];
    },
    enabled: !!profile?.organization_id,
    staleTime: 15000,
  });

  // Fetch menu items
  const menuItemsQuery = useQuery({
    queryKey: ['may-menu-items', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('knowledge_base_entries')
        .select('id, title, content, category, tags, image_url, is_active, display_order')
        .eq('organization_id', profile.organization_id)
        .eq('category', 'menu')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;

      return (data || []).map(item => ({
        id: item.id,
        name: item.title,
        description: item.content,
        price: null, // Extract from content if needed
        category: item.tags?.[0] || null,
        image_url: item.image_url,
        is_active: item.is_active,
      })) as MenuItem[];
    },
    enabled: !!profile?.organization_id,
    staleTime: 30000,
  });

  // Fetch calendar events for deliveries
  const deliveriesQuery = useQuery({
    queryKey: ['may-deliveries', profile?.organization_id],
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
    queryKey: ['may-calendar-events', profile?.organization_id],
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

  const orders = ordersQuery.data || [];
  const menuItems = menuItemsQuery.data || [];
  const calendarEvents = calendarEventsQuery.data || [];
  const syncedEvents = deliveriesQuery.data || [];

  const prepConfigsQuery = useQuery({
    queryKey: ['may-prep-configs', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('order_prep_configs' as any)
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data || []) as PrepConfig[];
    },
    enabled: !!profile?.organization_id,
    staleTime: 30000,
  });

  const prepTasksQuery = useQuery({
    queryKey: ['may-prep-tasks', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('order_prep_tasks' as any)
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('scheduled_start_time', { ascending: true });

      if (error) throw error;
      return (data || []) as PrepTask[];
    },
    enabled: !!profile?.organization_id,
    staleTime: 15000,
  });

  const prepConfigs = prepConfigsQuery.data || [];
  const prepTasks = prepTasksQuery.data || [];

  const totalOrderAmount = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  
  // Count upcoming events (from today onwards)
  const now = new Date();
  const upcomingInternalEvents = calendarEvents.filter(e => new Date(e.start_time) >= now).length;
  const upcomingSyncedEvents = syncedEvents.filter(e => new Date(e.start_time) >= now).length;
  const upcomingPrepTasks = prepTasks.filter(task => task.scheduled_start_time && new Date(task.scheduled_start_time) >= now && !['completed', 'cancelled'].includes(task.status)).length;

  const stats: OrderStats = {
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    confirmedOrders: orders.filter(o => o.status === 'confirmed').length,
    preparingOrders: orders.filter(o => o.status === 'preparing').length,
    readyOrders: orders.filter(o => o.status === 'ready').length,
    totalMenuItems: menuItems.length,
    averageOrderValue: orders.length > 0 ? Math.round(totalOrderAmount / orders.length) : 0,
    upcomingEvents: upcomingInternalEvents + upcomingSyncedEvents + upcomingPrepTasks,
  };

  const isLoading = ordersQuery.isLoading || menuItemsQuery.isLoading || calendarEventsQuery.isLoading || prepConfigsQuery.isLoading || prepTasksQuery.isLoading;

  const refetchAll = async () => {
    await Promise.all([
      ordersQuery.refetch(),
      menuItemsQuery.refetch(),
      calendarEventsQuery.refetch(),
      deliveriesQuery.refetch(),
      prepConfigsQuery.refetch(),
      prepTasksQuery.refetch(),
    ]);
  };

  return {
    orders,
    menuItems,
    calendarEvents: calendarEvents as InternalCalendarEvent[],
    syncedEvents: syncedEvents as CalendarSyncEvent[],
    prepConfigs,
    prepTasks,
    stats,
    isLoading,
    refetchAll,
  };
}
