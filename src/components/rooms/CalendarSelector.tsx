import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Loader2, Calendar, Link, X, RefreshCw, AlertCircle, RotateCcw } from 'lucide-react';
import { useGoogleCalendar, GoogleCalendar } from '@/hooks/useGoogleCalendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// Available booking source platforms
export const BOOKING_SOURCES = [
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'booking_com', label: 'Booking.com' },
  { value: 'vrbo', label: 'VRBO' },
  { value: 'expedia', label: 'Expedia' },
  { value: 'agoda', label: 'Agoda' },
  { value: 'tripadvisor', label: 'TripAdvisor' },
  { value: 'direct', label: 'Direct Booking' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google', label: 'Google Calendar' },
  { value: 'other', label: 'Other' },
] as const;

export type BookingSource = typeof BOOKING_SOURCES[number]['value'];

interface CalendarSelectorProps {
  value: string[];
  onChange: (calendarIds: string[]) => void;
  calendarSources?: Record<string, string>;
  onSourcesChange?: (sources: Record<string, string>) => void;
  initialCalendarIds?: string[];
  initialCalendarSources?: Record<string, string>;
}

export function CalendarSelector({ 
  value, 
  onChange, 
  calendarSources = {}, 
  onSourcesChange,
  initialCalendarIds = [],
  initialCalendarSources = {}
}: CalendarSelectorProps) {
  const { checkConnection, listCalendars, initiateOAuth, isLoading } = useGoogleCalendar();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    const result = await checkConnection();
    setConnected(result.connected);
    if (result.connected) {
      fetchCalendars();
    }
  };

  const fetchCalendars = async () => {
    setLoadingCalendars(true);
    const cals = await listCalendars();
    setCalendars(cals);
    setLoadingCalendars(false);
  };

  const handleConnect = async () => {
    const authUrl = await initiateOAuth();
    if (authUrl) {
      window.location.href = authUrl;
    }
  };

  const toggleCalendar = (calendarId: string) => {
    if (value.includes(calendarId)) {
      onChange(value.filter(id => id !== calendarId));
      // Also remove the source mapping
      if (onSourcesChange) {
        const newSources = { ...calendarSources };
        delete newSources[calendarId];
        onSourcesChange(newSources);
      }
    } else {
      onChange([...value, calendarId]);
      // Always default to 'google' for new calendars - ensure source is set
      const newSources = { ...calendarSources, [calendarId]: 'google' };
      if (onSourcesChange) {
        onSourcesChange(newSources);
      }
    }
  };

  const removeCalendar = (calendarId: string) => {
    onChange(value.filter(id => id !== calendarId));
    if (onSourcesChange) {
      const newSources = { ...calendarSources };
      delete newSources[calendarId];
      onSourcesChange(newSources);
    }
  };

  const updateCalendarSource = (calendarId: string, source: string) => {
    if (onSourcesChange) {
      onSourcesChange({ ...calendarSources, [calendarId]: source });
    }
  };

  const resetCalendarSources = () => {
    onChange(initialCalendarIds);
    if (onSourcesChange) {
      onSourcesChange(initialCalendarSources);
    }
  };

  const hasChanges = () => {
    if (value.length !== initialCalendarIds.length) return true;
    if (!value.every(id => initialCalendarIds.includes(id))) return true;
    const currentSourcesStr = JSON.stringify(calendarSources);
    const initialSourcesStr = JSON.stringify(initialCalendarSources);
    return currentSourcesStr !== initialSourcesStr;
  };

  const getCalendarName = (calendarId: string) => {
    const cal = calendars.find(c => c.id === calendarId);
    return cal?.name || calendarId;
  };

  const getSourceLabel = (sourceValue: string) => {
    const source = BOOKING_SOURCES.find(s => s.value === sourceValue);
    return source?.label || sourceValue;
  };

  if (connected === null) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Checking calendar connection...
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
          <AlertCircle className="w-4 h-4 text-warning shrink-0" />
          <p className="text-sm text-warning">
            Connect to Google to select calendars for this room.
          </p>
        </div>
        <Button onClick={handleConnect} disabled={isLoading} variant="outline" className="w-full">
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Link className="w-4 h-4 mr-2" />
          )}
          Connect to Google
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Select calendars and specify their source platform
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={fetchCalendars}
          disabled={loadingCalendars}
          className="h-7 text-xs"
        >
          <RefreshCw className={cn("w-3 h-3 mr-1", loadingCalendars && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal"
            disabled={loadingCalendars}
          >
            {loadingCalendars ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading calendars...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 mr-2" />
                {value.length === 0 
                  ? "Select calendars..." 
                  : `${value.length} calendar${value.length > 1 ? 's' : ''} selected`}
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0 z-50 bg-popover border shadow-md" align="start">
          <ScrollArea className="h-[250px]">
            <div className="p-2 space-y-1">
              {calendars.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No calendars found
                </p>
              ) : (
                calendars.map((calendar) => (
                  <div
                    key={calendar.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-secondary/50 transition-colors",
                      value.includes(calendar.id) && "bg-secondary"
                    )}
                    onClick={() => toggleCalendar(calendar.id)}
                  >
                    <Checkbox
                      checked={value.includes(calendar.id)}
                      onCheckedChange={() => toggleCalendar(calendar.id)}
                    />
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: calendar.backgroundColor || '#4285F4' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{calendar.name}</p>
                      {calendar.primary && (
                        <p className="text-xs text-muted-foreground">Primary</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">
              Specify source for each calendar:
            </p>
            {hasChanges() && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetCalendarSources}
                className="h-6 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
            )}
          </div>
          {value.map((calId) => {
            const cal = calendars.find(c => c.id === calId);
            const currentSource = calendarSources[calId] || 'google';
            return (
              <div
                key={calId}
                className="flex flex-col gap-2 p-2 rounded-lg border bg-card overflow-hidden"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: cal?.backgroundColor || '#4285F4' }}
                  />
                  <span className="flex-1 text-sm truncate max-w-[200px]" title={getCalendarName(calId)}>
                    {getCalendarName(calId)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 hover:bg-destructive/20"
                    onClick={() => removeCalendar(calId)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 pl-4">
                  <span className="text-xs text-muted-foreground shrink-0">Source:</span>
                  <Input
                    value={currentSource}
                    onChange={(e) => updateCalendarSource(calId, e.target.value)}
                    placeholder="e.g., Airbnb, Booking.com"
                    className="h-7 text-xs flex-1 min-w-0"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
