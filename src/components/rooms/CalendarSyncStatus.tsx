import { useEffect, useMemo, useState } from 'react';
import { devError } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  RefreshCw, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import { format, formatDistanceToNow, isAfter, isBefore, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getCalendarSyncHealth } from '@/lib/calendarSyncHealth';

interface CalendarSyncEvent {
  id: string;
  room_unit_id: string;
  calendar_id: string;
  google_event_id: string;
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
  calendar_name: string | null;
  synced_at: string;
}

interface CalendarSyncStatusProps {
  roomUnitId: string;
  roomName: string;
  compact?: boolean;
}

const platformColors: Record<string, string> = {
  airbnb: 'bg-[#FF5A5F] text-white',
  booking_com: 'bg-[#003580] text-white',
  vrbo: 'bg-[#0E4B82] text-white',
  expedia: 'bg-[#FFCC00] text-black',
  agoda: 'bg-[#5391D4] text-white',
  direct: 'bg-success text-white',
  google: 'bg-[#4285F4] text-white',
  unknown: 'bg-muted text-muted-foreground',
};

const platformLabels: Record<string, string> = {
  airbnb: 'Airbnb',
  booking_com: 'Booking.com',
  vrbo: 'VRBO',
  expedia: 'Expedia',
  agoda: 'Agoda',
  direct: 'Direct',
  facebook: 'Facebook',
  manual: 'Manual',
  google: 'Google',
  unknown: 'External',
};

export function CalendarSyncStatus({ roomUnitId, roomName, compact = false }: CalendarSyncStatusProps) {
  const [events, setEvents] = useState<CalendarSyncEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [hasConnectedCalendars, setHasConnectedCalendars] = useState(false);

  useEffect(() => {
    void fetchSyncedEvents();
  }, [roomUnitId]);

  const fetchSyncedEvents = async () => {
    try {
      setLoading(true);
      const [{ data: eventsData, error: eventsError }, { data: latestSyncRow, error: latestSyncError }, { data: roomData, error: roomError }] = await Promise.all([
        supabase
          .from('calendar_sync_events')
          .select('*')
          .eq('room_unit_id', roomUnitId)
          .gte('end_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(20),
        supabase
          .from('calendar_sync_events')
          .select('synced_at')
          .eq('room_unit_id', roomUnitId)
          .order('synced_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('room_units')
          .select('calendar_ids')
          .eq('id', roomUnitId)
          .maybeSingle(),
      ]);

      if (eventsError) throw eventsError;
      if (latestSyncError) throw latestSyncError;
      if (roomError) throw roomError;

      setEvents(eventsData || []);
      setLastSyncTime(latestSyncRow?.synced_at ? new Date(latestSyncRow.synced_at) : null);
      setHasConnectedCalendars(Array.isArray(roomData?.calendar_ids) && roomData.calendar_ids.length > 0);
    } catch (error) {
      devError('Error fetching synced events:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncHealth = useMemo(
    () => getCalendarSyncHealth(lastSyncTime, hasConnectedCalendars ? 1 : 0),
    [lastSyncTime, hasConnectedCalendars],
  );

  const syncTone = {
    fresh: 'border-success/20 bg-success/5 text-success',
    warning: 'border-warning/20 bg-warning/5 text-warning',
    stale: 'border-destructive/20 bg-destructive/5 text-destructive',
    'never-synced': 'border-warning/20 bg-warning/5 text-warning',
    'no-integrations': 'border-border bg-muted/40 text-muted-foreground',
  }[syncHealth.status];

  const syncLabel = {
    fresh: 'Fresh',
    warning: 'Delayed',
    stale: 'Stale',
    'never-synced': 'Not synced',
    'no-integrations': 'No calendars',
  }[syncHealth.status];

  const syncMessage = syncHealth.status === 'no-integrations'
    ? 'Link one or more room calendars to keep availability and AI answers aligned.'
    : syncHealth.status === 'never-synced'
      ? 'Calendars are linked for this room, but the first sync has not completed yet.'
      : syncHealth.status === 'fresh'
        ? `Last successful sync ${formatDistanceToNow(syncHealth.lastSyncTime as Date, { addSuffix: true })}.`
        : `Sync may be behind. Last successful sync ${formatDistanceToNow(syncHealth.lastSyncTime as Date, { addSuffix: true })}.`;

  const triggerManualSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-calendar-events');
      
      if (error) throw error;
      
      toast.success(`Synced ${data?.synced || 0} calendar events`);
      
      // Refresh the events list
      await fetchSyncedEvents();
    } catch (error) {
      devError('Error syncing calendars:', error);
      toast.error('Failed to sync calendars');
    } finally {
      setSyncing(false);
    }
  };

  const upcomingEvents = events.filter(e => isAfter(parseISO(e.start_time), new Date()));
  const currentEvents = events.filter(e => 
    isBefore(parseISO(e.start_time), new Date()) && 
    isAfter(parseISO(e.end_time), new Date())
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={cn('text-xs', syncTone)}>
          {syncLabel}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={triggerManualSync}
          disabled={syncing}
          className="h-7"
        >
          <RefreshCw className={cn("w-3 h-3 mr-1", syncing && "animate-spin")} />
          Sync
        </Button>
        {events.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {events.length} events
          </Badge>
        )}
        {lastSyncTime && (
          <span className="text-xs text-muted-foreground">
            Last sync: {format(lastSyncTime, 'HH:mm')}
          </span>
        )}
      </div>
    );
  }

  return (
    <Card className="glass">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Calendar Sync
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastSyncTime && (
              <span className="text-xs text-muted-foreground">
                Last sync: {format(lastSyncTime, 'MMM d, HH:mm')}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={triggerManualSync}
              disabled={syncing}
            >
              <RefreshCw className={cn("w-3 h-3 mr-1", syncing && "animate-spin")} />
              Sync Now
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn('mb-4 flex items-start gap-3 rounded-lg border px-3 py-2 text-xs', syncTone)}>
          {syncHealth.status === 'fresh' ? (
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          ) : syncHealth.status === 'no-integrations' ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{syncLabel}</span>
              {lastSyncTime && (
                <span className="text-muted-foreground">
                  {format(lastSyncTime, 'MMM d, HH:mm')}
                </span>
              )}
            </div>
            <p className="text-muted-foreground">
              {syncMessage} Operational availability merges in-app bookings with synced external calendars for {roomName}.
            </p>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {hasConnectedCalendars ? 'No upcoming external events synced' : 'No calendars linked to this room'}
            </p>
            <p className="text-xs mt-1">
              {hasConnectedCalendars
                ? 'Existing in-app bookings still count toward availability and AI responses.'
                : 'Link calendars to import third-party bookings into your availability model.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current Events */}
            {currentEvents.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                  Currently Occupied
                </p>
                <div className="space-y-2">
                  {currentEvents.map(event => (
                    <EventCard key={event.id} event={event} isCurrent />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Events */}
            {upcomingEvents.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                  Upcoming ({upcomingEvents.length})
                </p>
                <div className="space-y-2">
                  {upcomingEvents.slice(0, 5).map(event => (
                    <EventCard key={event.id} event={event} />
                  ))}
                  {upcomingEvents.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      +{upcomingEvents.length - 5} more events
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EventCard({ event, isCurrent = false }: { event: CalendarSyncEvent; isCurrent?: boolean }) {
  const startDate = parseISO(event.start_time);
  const endDate = parseISO(event.end_time);
  const platform = event.source_platform || 'unknown';
  
  return (
    <div className={cn(
      "p-3 rounded-lg border transition-colors",
      isCurrent 
        ? "bg-primary/5 border-primary/30" 
        : "bg-muted/30 border-border hover:bg-muted/50"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge 
              variant="secondary" 
              className={cn("text-xs", platformColors[platform])}
            >
              {platformLabels[platform] || platform}
            </Badge>
            {isCurrent && (
              <Badge variant="default" className="text-xs bg-success">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Active
              </Badge>
            )}
          </div>
          
          {event.guest_name && (
            <p className="font-medium text-sm flex items-center gap-1">
              <User className="w-3 h-3 text-muted-foreground" />
              {event.guest_name}
              {event.guest_count && event.guest_count > 1 && (
                <span className="text-xs text-muted-foreground">
                  (+{event.guest_count - 1})
                </span>
              )}
            </p>
          )}
          
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <Clock className="w-3 h-3" />
            {event.all_day ? (
              <>
                {format(startDate, 'MMM d')} - {format(endDate, 'MMM d')}
              </>
            ) : (
              <>
                {format(startDate, 'MMM d, HH:mm')} - {format(endDate, 'MMM d, HH:mm')}
              </>
            )}
          </div>
          
          {event.calendar_name && (
            <p className="text-xs text-muted-foreground mt-1">
              via {event.calendar_name}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
