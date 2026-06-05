import { useEffect, useMemo, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users,
  Clock,
  Loader2,
  GraduationCap,
  MessageSquare,
  UserCheck,
  MessagesSquare,
  ArrowRight,
  BedDouble,
  DollarSign
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInDays, addDays, parseISO } from 'date-fns';
import { StatsCard } from '@/components/shared/StatsCard';
import { PullToRefresh } from '@/components/shared/PullToRefresh';
import { AgentManagedLeadsBanner } from '@/components/AgentManagedLeadsBanner';
import { useNavigate } from 'react-router-dom';
import { devLog } from '@/lib/logger';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { UpcomingBookingsWidget } from './UpcomingBookingsWidget';
import { SimpleBookingsWidget } from './SimpleBookingsWidget';
import { DashboardHeader } from './DashboardHeader';

import { WidgetCustomizer } from './WidgetCustomizer';
import { DashboardSkeleton } from './DashboardSkeleton';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';


interface Conversation {
  id: string;
  platform: string;
  status: string;
  started_at: string;
  lead_id: string | null;
  lead?: {
    name: string;
  } | null;
}

interface TeamChat {
  id: string;
  name: string | null;
  chat_type: string;
  updated_at: string;
  unread_count?: number;
}

interface TrainingSession {
  id: string;
  score: number | null;
  ended_at: string | null;
  module?: {
    title: string;
  } | null;
}

const WIDGET_CONFIG = [
  { id: 'stats', label: 'Statistics Cards', description: 'Key booking metrics' },
  { id: 'bookings', label: 'Upcoming Bookings', description: 'Check-ins and check-outs' },
  { id: 'revenue', label: 'Revenue Summary', description: 'Booking revenue overview' },
  { id: 'conversations', label: 'Conversations', description: 'Recent AI conversations' },
  { id: 'training', label: 'Personal Training', description: 'Your training sessions' },
  { id: 'teamchat', label: 'Team Chat', description: 'Team chat activity' },
];

export default function CeceDashboard(): JSX.Element {
  const { profile, isClientAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const formatCurrency = useFormatCurrency();
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dashboard customization - different defaults for client admin vs agent
  const defaultWidgets = isClientAdmin 
    ? ['stats', 'bookings', 'revenue', 'conversations', 'training', 'teamchat']
    : ['stats', 'bookings', 'conversations', 'training', 'teamchat'];
  
  const availableWidgetsList = ['stats', 'bookings', 'revenue', 'conversations', 'training', 'teamchat'];

  const {
    selectedWidgets,
    availableWidgets,
    isEditMode,
    setIsEditMode,
    isSaving,
    isLoading: isLayoutLoading,
    saveLayout,
    resetLayout,
    toggleWidget,
  } = useDashboardLayout(
    'cece',
    defaultWidgets,
    availableWidgetsList,
    {}
  );


  // Fetch recent AI conversations for the org
  const { data: conversations = [], isLoading: convsLoading } = useQuery({
    queryKey: ['agent-conversations', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('id, platform, status, started_at, lead_id, lead:leads(name)')
        .eq('organization_id', profile.organization_id)
        .order('started_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []).map(c => ({
        ...c,
        lead: c.lead as Conversation['lead'],
      })) as Conversation[];
    },
    enabled: !!profile?.organization_id,
  });

  // Fetch team chats the agent is part of
  const { data: teamChats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ['agent-team-chats', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('team_chat_members')
        .select('chat:team_chats(id, name, chat_type, updated_at)')
        .eq('user_id', profile.id)
        .order('joined_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || [])
        .map(d => d.chat)
        .filter(Boolean) as TeamChat[];
    },
    enabled: !!profile?.id,
  });

  // Fetch personal training sessions
  const { data: trainingSessions = [], isLoading: trainingLoading } = useQuery({
    queryKey: ['agent-training-sessions', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('training_sessions')
        .select('id, score, ended_at, module:training_modules(title)')
        .eq('user_id', profile.id)
        .order('ended_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []).map(s => ({
        ...s,
        module: s.module as TrainingSession['module'],
      })) as TrainingSession[];
    },
    enabled: !!profile?.id,
  });

  // Fetch bookings for the organization - with auto-refresh
  const { data: bookings = [], isLoading: bookingsLoading, refetch: refetchBookings } = useQuery({
    queryKey: ['dashboard-bookings', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          room_unit_id,
          check_in,
          check_out,
          guest_count,
          status,
          notes,
          created_at,
          total_price,
          calendar_event_id,
          room:room_units(name, price_per_night),
          lead:leads(name, phone)
        `)
        .eq('organization_id', profile.organization_id)
        .in('status', ['pending', 'confirmed', 'upcoming', 'checked_in'])
        .order('check_in', { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data || []).map(b => ({
        ...b,
        room: b.room as { name: string; price_per_night?: number } | undefined,
        lead: b.lead as { name: string; phone: string | null } | undefined,
      }));
    },
    enabled: !!profile?.organization_id,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  // Fetch calendar sync events for external bookings
  const { data: calendarSyncEvents = [], refetch: refetchCalendarEvents } = useQuery({
    queryKey: ['dashboard-calendar-events', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const today = format(new Date(), 'yyyy-MM-dd');
      const thirtyDaysFromNow = format(addDays(new Date(), 30), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('calendar_sync_events')
        .select('*')
        .gte('end_time', today)
        .lte('start_time', thirtyDaysFromNow)
        .order('start_time', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organization_id,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  // Combine bookings with external calendar events
  const allBookingsWithExternal = useMemo(() => {
    // Build set of linked calendar event IDs
    const linkedEventKeys = new Set(
      bookings
        .filter(b => b.calendar_event_id)
        .map(b => `${b.room_unit_id}:${b.calendar_event_id}`)
    );

    // Convert calendar events to booking format
    const externalBookings = calendarSyncEvents
      .filter(event => !linkedEventKeys.has(`${event.room_unit_id}:${event.google_event_id}`))
      .map(event => {
        const checkInDate = event.all_day 
          ? event.start_time.slice(0, 10) 
          : format(parseISO(event.start_time), 'yyyy-MM-dd');
        const checkOutDate = event.all_day 
          ? event.end_time.slice(0, 10) 
          : format(parseISO(event.end_time), 'yyyy-MM-dd');

        return {
          id: `external-${event.id}`,
          room_unit_id: event.room_unit_id,
          check_in: checkInDate,
          check_out: checkOutDate,
          guest_count: event.guest_count || 1,
          status: 'external',
          notes: null,
          created_at: event.created_at,
          total_price: null,
          room: undefined, // Will be matched by room_unit_id if needed
          lead: { name: event.guest_name || event.title || 'External Booking', phone: event.guest_phone },
        };
      });

    return [...bookings, ...externalBookings];
  }, [bookings, calendarSyncEvents]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchBookings(), refetchCalendarEvents()]);
      queryClient.invalidateQueries({ queryKey: ['agent-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['agent-team-chats'] });
      queryClient.invalidateQueries({ queryKey: ['agent-training-sessions'] });
      setLastRefreshed(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchBookings, refetchCalendarEvents, queryClient]);

  // Run auto-update for booking statuses on mount and set up realtime subscription
  useEffect(() => {
    devLog('CeceDashboard (Agent) mounted');
    
    // Trigger auto-update of booking statuses for this org immediately
    const runAutoUpdate = async () => {
      if (!profile?.organization_id) return;
      
      try {
        const { data, error } = await supabase.functions.invoke('auto-update-booking-status', {
          body: { organizationId: profile.organization_id }
        });
        
        if (error) {
          devLog('Auto-update booking status error:', error);
        } else if (data?.checked_in > 0 || data?.checked_out > 0) {
          devLog(`Auto-updated bookings: ${data.checked_in} checked in, ${data.checked_out} checked out`);
          refetchBookings();
        } else {
          devLog('Auto-update complete, no changes needed');
        }
      } catch (err) {
        devLog('Auto-update booking status exception:', err);
      }
    };

    runAutoUpdate();

    // Subscribe to realtime booking changes
    const channel = supabase
      .channel('cece-dashboard-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: profile?.organization_id ? `organization_id=eq.${profile.organization_id}` : undefined
        },
        (payload) => {
          devLog('Booking change detected:', payload.eventType);
          refetchBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.organization_id, refetchBookings]);

  // Stats calculations
  const stats = useMemo(() => {
    const activeConvs = conversations.filter(c => c.status === 'active').length;
    const avgScore = trainingSessions.length > 0
      ? trainingSessions.reduce((acc, s) => acc + (s.score || 0), 0) / trainingSessions.length
      : null;

    // Calculate booking stats based on actual status - aligned with UpcomingBookingsWidget logic
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    // Arrivals today: upcoming/pending bookings scheduled for today
    const arrivalsToday = bookings.filter(b => 
      b.check_in === todayStr && 
      (b.status === 'upcoming' || b.status === 'pending')
    ).length;
    
    // Currently in-house: checked_in OR upcoming guests whose stay spans today
    const inHouse = bookings.filter(b => {
      if (b.status === 'checked_in') return true;
      if (b.status === 'upcoming') {
        const checkIn = new Date(b.check_in);
        const checkOut = new Date(b.check_out);
        return checkIn <= today && checkOut > today;
      }
      return false;
    }).length;
    
    // Departures today: in-house guests (checked_in or upcoming) scheduled to leave today
    const departuresToday = bookings.filter(b => 
      b.check_out === todayStr && 
      (b.status === 'checked_in' || b.status === 'upcoming')
    ).length;

    return {
      cards: [
        { 
          label: 'Arrivals Today', 
          value: arrivalsToday.toString(), 
          icon: BedDouble,
          color: 'text-success',
          path: '/accommodation'
        },
        { 
          label: 'In-House Guests', 
          value: inHouse.toString(), 
          icon: Users,
          color: 'text-primary',
          path: '/accommodation'
        },
        { 
          label: 'Departures Today', 
          value: departuresToday.toString(), 
          icon: UserCheck,
          color: 'text-warning',
          path: '/accommodation'
        },
        { 
          label: 'Active Conversations', 
          value: activeConvs.toString(), 
          icon: MessageSquare,
          color: 'text-info',
          path: '/chats'
        },
      ]
    };
  }, [conversations, trainingSessions, bookings]);

  // Revenue calculations for the revenue widget
  const revenueStats = useMemo(() => {
    // Calculate revenue from bookings
    // Use total_price if available, otherwise calculate from room rate × nights
    const calculateBookingRevenue = (booking: typeof bookings[0]) => {
      if (booking.total_price != null) {
        return Number(booking.total_price);
      }
      // Fallback: calculate from room rate × nights
      const pricePerNight = booking.room?.price_per_night || 0;
      const checkIn = new Date(booking.check_in);
      const checkOut = new Date(booking.check_out);
      const nights = Math.max(1, differenceInDays(checkOut, checkIn));
      return pricePerNight * nights;
    };

    // Total projected revenue from active bookings
    const projectedRevenue = bookings
      .filter(b => b.status !== 'cancelled')
      .reduce((sum, b) => sum + calculateBookingRevenue(b), 0);

    // In-house guests revenue (currently checked in)
    const inHouseRevenue = bookings
      .filter(b => b.status === 'checked_in')
      .reduce((sum, b) => sum + calculateBookingRevenue(b), 0);

    // Average booking value
    const avgBookingValue = bookings.length > 0 ? projectedRevenue / bookings.length : 0;

    return {
      projectedRevenue,
      inHouseRevenue,
      avgBookingValue,
      totalBookings: bookings.length,
    };
  }, [bookings]);

  const isDataLoading = convsLoading || chatsLoading || trainingLoading || bookingsLoading;

  // Show skeleton while initial data loads
  if (isLayoutLoading || isDataLoading) {
    return <DashboardSkeleton />;
  }

  const widgetsForCustomizer = WIDGET_CONFIG.filter(w => availableWidgets.includes(w.id));

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-3 md:space-y-4 lg:space-y-6 animate-fade-in" data-tour="dashboard-content">
      {/* Agent Control Banner */}
        <AgentManagedLeadsBanner />
        
        {/* Header */}
        <DashboardHeader
          userName={profile?.full_name}
          subtitle="Your hospitality overview"
          onCustomize={() => setIsEditMode(!isEditMode)}
          onRefresh={handleRefresh}
          isEditMode={isEditMode}
          isRefreshing={isRefreshing}
          lastRefreshed={lastRefreshed}
        />


        {/* Edit Mode Panel */}
        {isEditMode && (
          <WidgetCustomizer
            widgets={widgetsForCustomizer}
            selectedWidgets={selectedWidgets}
            onToggle={toggleWidget}
            onSave={saveLayout}
            onReset={resetLayout}
            isSaving={isSaving}
          />
        )}

        {/* Stats Grid */}
        {selectedWidgets.includes('stats') && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 lg:gap-4">
            {stats.cards.map((stat, index) => (
              <StatsCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                icon={stat.icon}
                iconColor={stat.color}
                path={stat.path}
                animationDelay={index * 100}
              />
            ))}
          </div>
        )}

        {/* Bookings Widget - Detailed for client admin, Simple for agent */}
        {selectedWidgets.includes('bookings') && (
          isClientAdmin ? (
            <UpcomingBookingsWidget bookings={allBookingsWithExternal} isLoading={bookingsLoading} />
          ) : (
            <SimpleBookingsWidget bookings={allBookingsWithExternal} isLoading={bookingsLoading} />
          )
        )}

        {/* Revenue Widget - Client admin only */}
        {selectedWidgets.includes('revenue') && isClientAdmin && (
          <Card className="glass">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-success" />
                  Revenue Overview
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate('/reporting')} className="gap-1">
                  View Reports <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-success" />
                    <span className="text-xs text-muted-foreground">Projected</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(revenueStats.projectedRevenue)}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-2 mb-1">
                    <BedDouble className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground">In-House</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(revenueStats.inHouseRevenue)}</p>
                </div>
                <div className="p-3 rounded-lg bg-info/10 border border-info/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-info" />
                    <span className="text-xs text-muted-foreground">Avg Value</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(revenueStats.avgBookingValue)}</p>
                </div>
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-warning" />
                    <span className="text-xs text-muted-foreground">Active</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">{revenueStats.totalBookings}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          {/* Recent Conversations Widget */}
          {selectedWidgets.includes('conversations') && (
            <Card className="glass">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-success" />
                    Recent Conversations
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/chats')} className="gap-1">
                    View All <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {convsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No recent conversations</p>
                ) : (
                  <div className="space-y-2">
                    {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className="p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => navigate(conv.lead_id ? `/chats?leadId=${conv.lead_id}` : '/chats')}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{conv.lead?.name || 'Unknown Guest'}</p>
                            <p className="text-xs text-muted-foreground capitalize">{conv.platform}</p>
                          </div>
                          <Badge variant={conv.status === 'active' ? 'default' : 'secondary'}>
                            {conv.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(conv.started_at), { addSuffix: true })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Personal Training Widget */}
          {selectedWidgets.includes('training') && (
            <Card className="glass">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-warning" />
                    My Training Sessions
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/ai-training')} className="gap-1">
                    Start Training <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {trainingLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : trainingSessions.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-2">No training sessions yet</p>
                    <Button size="sm" onClick={() => navigate('/ai-training')}>
                      Start Your First Session
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {trainingSessions.map((session) => (
                      <div
                        key={session.id}
                        className="p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{session.module?.title || 'Training Session'}</p>
                          {session.score !== null && (
                            <Badge variant={session.score >= 70 ? 'default' : 'secondary'}>
                              {session.score}%
                            </Badge>
                          )}
                        </div>
                        {session.ended_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Completed {formatDistanceToNow(new Date(session.ended_at), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Team Chat Activity Widget */}
          {selectedWidgets.includes('teamchat') && (
            <Card className="glass">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                    <MessagesSquare className="w-5 h-5 text-primary" />
                    Team Chats
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/team-chat')} className="gap-1">
                    Open Chat <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {chatsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : teamChats.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No team chats yet</p>
                ) : (
                  <div className="space-y-2">
                    {teamChats.map((chat) => (
                      <div
                        key={chat.id}
                        className="p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => navigate('/team-chat')}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{chat.name || 'Direct Message'}</p>
                            <p className="text-xs text-muted-foreground capitalize">{chat.chat_type.replace('_', ' ')}</p>
                          </div>
                          <Badge variant="outline">
                            {formatDistanceToNow(new Date(chat.updated_at), { addSuffix: true })}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}
