import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  RefreshCw, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Settings,
  Clock,
  CalendarDays,
  CalendarClock,
  TrendingUp,
  Sun,
  Loader2,
  ExternalLink,
  MapPin,
  Users,
  Filter,
  X,
  Edit,
  Save,
  Repeat,
  AlertTriangle,
  HelpCircle,
  Download
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths, 
  parseISO,
  isToday,
  isTomorrow,
  addDays,
  startOfWeek,
  endOfWeek,
  differenceInMinutes,
  isWithinInterval
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Link } from 'react-router-dom';
import { useGoogleCalendar, CalendarEvent, GoogleCalendar } from '@/hooks/useGoogleCalendar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { devLog } from '@/lib/logger';
import { KeyboardShortcutsDialog } from '@/components/KeyboardShortcutsDialog';
import { ExportDialog } from '@/components/ExportDialog';
import { formatDistanceToNow } from 'date-fns';

interface CalendarSource {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
}

const FALLBACK_COLORS = [
  'hsl(var(--primary))',
  'hsl(142 76% 36%)',
  'hsl(38 92% 50%)',
  'hsl(280 65% 60%)',
  'hsl(199 89% 48%)',
];

function CalendarPageContent() {
  const { checkConnection, listCalendars, listEvents, createEvent, updateEvent, deleteEvent, isLoading, error } = useGoogleCalendar();
  const { syncCalendars, isSyncing: isCalendarSyncing, syncHealth } = useCalendarSync();
  const { toast } = useToast();
  
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCalendarManagerOpen, setIsCalendarManagerOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [calendarFilter, setCalendarFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefetching, setIsRefetching] = useState(false);
  
  // Touch/swipe state for mobile navigation
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;
  
  // Multi-calendar support - now fetched from Google
  const [calendars, setCalendars] = useState<CalendarSource[]>([]);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendar[]>([]);
  
  // Handle swipe gestures for month navigation
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) {
      setCurrentMonth(addMonths(currentMonth, 1));
    } else if (isRightSwipe) {
      setCurrentMonth(subMonths(currentMonth, 1));
    }
  };

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        setSelectedDate(prev => addDays(prev, -1));
        break;
      case 'ArrowRight':
        e.preventDefault();
        setSelectedDate(prev => addDays(prev, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedDate(prev => addDays(prev, -7));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelectedDate(prev => addDays(prev, 7));
        break;
      case 'n':
        e.preventDefault();
        if (!isCreateDialogOpen) setIsCreateDialogOpen(true);
        break;
      case 't':
        e.preventDefault();
        setSelectedDate(new Date());
        setCurrentMonth(new Date());
        break;
      case 'e':
      case 'E':
        e.preventDefault();
        if (selectedEvent && !isEditDialogOpen) {
          setIsEditDialogOpen(true);
        }
        break;
      case 'd':
      case 'D':
        e.preventDefault();
        if (selectedEvent && !isDeleteDialogOpen) {
          setIsDeleteDialogOpen(true);
        }
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        setIsCalendarManagerOpen(true);
        break;
      case 's':
      case 'S':
        e.preventDefault();
        if (!isRefetching) {
          syncCalendars(true);
        }
        break;
      case '?':
        e.preventDefault();
        setIsShortcutsHelpOpen(true);
        break;
    }
  }, [isCreateDialogOpen, selectedEvent, isEditDialogOpen, isDeleteDialogOpen, isRefetching, syncCalendars]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  // New event form
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    attendees: '',
    allDay: false,
    calendarId: 'primary',
  });

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  // Update month when selected date changes
  useEffect(() => {
    if (!isSameMonth(selectedDate, currentMonth)) {
      setCurrentMonth(startOfMonth(selectedDate));
    }
  }, [selectedDate]);

  const checkConnectionStatus = async () => {
    setIsInitialLoading(true);
    try {
      const result = await checkConnection();
      setIsConnected(result.connected);
      if (result.connected) {
        await fetchCalendarsAndEvents();
      }
    } catch (err) {
      devLog('Error checking connection status:', err);
      toast({
        title: 'Connection check failed',
        description: 'Could not verify Google Calendar connection',
        variant: 'destructive'
      });
      setIsConnected(false);
    } finally {
      setIsInitialLoading(false);
    }
  };

  const fetchCalendarsAndEvents = async () => {
    try {
      // Fetch all available calendars
      const fetchedCalendars = await listCalendars();
      setGoogleCalendars(fetchedCalendars);
      
      // Load saved preferences from localStorage
      const savedPrefs = localStorage.getItem('calendar_preferences');
      let colorMap: Record<string, string> = {};
      let enabledMap: Record<string, boolean> = {};
      
      if (savedPrefs) {
        try {
          const prefs = JSON.parse(savedPrefs);
          prefs.colors?.forEach((c: { id: string; color: string }) => {
            colorMap[c.id] = c.color;
          });
          prefs.enabled?.forEach((e: { id: string; enabled: boolean }) => {
            enabledMap[e.id] = e.enabled;
          });
        } catch (err) {
          devLog('Error parsing saved preferences:', err);
        }
      }
      
      // Convert to CalendarSource format with colors (use saved or fallback)
      const sources: CalendarSource[] = fetchedCalendars.map((cal, index) => ({
        id: cal.id,
        name: cal.name,
        color: colorMap[cal.id] || cal.backgroundColor || FALLBACK_COLORS[index % FALLBACK_COLORS.length],
        enabled: enabledMap[cal.id] !== undefined ? enabledMap[cal.id] : true,
      }));
      setCalendars(sources);
      
      // Fetch events from enabled calendars only
      const enabledCalendarIds = sources.filter(c => c.enabled).map(c => c.id);
      const fetchedEvents = await listEvents(enabledCalendarIds.length > 0 ? enabledCalendarIds : undefined);
      setEvents(fetchedEvents);
      
      devLog(`[Calendar] Loaded ${fetchedCalendars.length} calendars and ${fetchedEvents.length} events`);
    } catch (err) {
      devLog('Error fetching calendars and events:', err);
      toast({
        title: 'Failed to load calendars',
        description: 'Could not fetch your calendars and events',
        variant: 'destructive'
      });
    }
  };

  const fetchEvents = async () => {
    try {
      // Get enabled calendar IDs
      const enabledCalendarIds = calendars.filter(c => c.enabled).map(c => c.id);
      const fetchedEvents = await listEvents(enabledCalendarIds.length > 0 ? enabledCalendarIds : undefined);
      setEvents(fetchedEvents);
    } catch (err) {
      devLog('Error fetching events:', err);
      toast({
        title: 'Failed to load events',
        description: 'Could not fetch calendar events',
        variant: 'destructive'
      });
    }
  };

  // Refetch events when calendar enabled state changes (fix for calendar filter bug)
  useEffect(() => {
    if (isConnected && calendars.length > 0 && !isInitialLoading) {
      const refetchEvents = async () => {
        setIsRefetching(true);
        try {
          const enabledCalendarIds = calendars.filter(c => c.enabled).map(c => c.id);
          const fetchedEvents = await listEvents(enabledCalendarIds.length > 0 ? enabledCalendarIds : undefined);
          setEvents(fetchedEvents);
        } catch (err) {
          devLog('Error refetching events:', err);
          toast({
            title: 'Failed to refresh events',
            description: 'Could not update calendar view',
            variant: 'destructive'
          });
        } finally {
          setIsRefetching(false);
        }
      };
      refetchEvents();
    }
  }, [calendars.map(c => `${c.id}-${c.enabled}`).join(','), isConnected, isInitialLoading]);

  // Stats calculations
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const weekEnd = endOfWeek(now);
    
    const todayEvents = events.filter(event => {
      const eventDate = parseISO(event.startTime);
      return isWithinInterval(eventDate, { start: todayStart, end: todayEnd });
    });
    
    const thisWeekEvents = events.filter(event => {
      const eventDate = parseISO(event.startTime);
      return isWithinInterval(eventDate, { start: now, end: weekEnd });
    });
    
    const upcomingEvents = events.filter(event => {
      const eventDate = parseISO(event.startTime);
      return eventDate >= now;
    }).sort((a, b) => parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime());
    
    return {
      total: events.length,
      today: todayEvents.length,
      thisWeek: thisWeekEvents.length,
      upcoming: upcomingEvents.slice(0, 5),
      calendarsCount: calendars.filter(c => c.enabled).length,
    };
  }, [events, calendars]);

  // Check for conflicting events
  const checkEventConflicts = (startTime: string, endTime: string, calendarId: string = 'primary', excludeEventId?: string): CalendarEvent[] => {
    const eventStart = parseISO(startTime);
    const eventEnd = parseISO(endTime);
    
    return events.filter(event => {
      // Skip if event is being edited (exclude by ID)
      if (excludeEventId && event.id === excludeEventId) return false;
      
      // Only check events in the same calendar
      if ((event.calendarId || 'primary') !== calendarId) return false;
      
      const existingStart = parseISO(event.startTime);
      const existingEnd = parseISO(event.endTime);
      
      // Check for overlap: event starts before existing ends AND event ends after existing starts
      return eventStart < existingEnd && eventEnd > existingStart;
    });
  };

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.startDate || !newEvent.startTime || !newEvent.endDate || !newEvent.endTime) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    const startTime = `${newEvent.startDate}T${newEvent.startTime}:00`;
    const endTime = `${newEvent.endDate}T${newEvent.endTime}:00`;
    const attendees = newEvent.attendees ? newEvent.attendees.split(',').map(e => e.trim()).filter(Boolean) : undefined;
    
    // Check for conflicts
    const conflictingEvents = checkEventConflicts(startTime, endTime, newEvent.calendarId);
    if (conflictingEvents.length > 0) {
      const conflictList = conflictingEvents.map(e => e.title).join(', ');
      toast({
        title: 'Time slot conflict',
        description: `You have conflicting events: ${conflictList}. Continue anyway?`,
        variant: 'destructive',
      });
      // Return early to let user confirm (in future: add confirmation dialog)
      return;
    }

    const success = await createEvent({
      title: newEvent.title,
      description: newEvent.description,
      startTime,
      endTime,
      attendees,
    });

    if (success) {
      toast({
        title: 'Event created',
        description: 'Your event has been added to the calendar.',
      });
      setIsCreateDialogOpen(false);
      setNewEvent({ title: '', description: '', startDate: '', startTime: '', endDate: '', endTime: '', attendees: '', allDay: false, calendarId: 'primary' });
      fetchEvents();
    } else {
      toast({
        title: 'Failed to create event',
        description: error || 'An error occurred while creating the event.',
        variant: 'destructive',
      });
    }
  };

  const openCreateDialogWithDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setNewEvent(prev => ({ 
      ...prev, 
      startDate: dateStr, 
      endDate: dateStr,
      startTime: '09:00',
      endTime: '10:00'
    }));
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setSelectedEvent(event);
    // Pre-fill form with event data
    const startDate = event.allDay 
      ? event.startTime.split('T')[0]
      : format(parseISO(event.startTime), 'yyyy-MM-dd');
    const endDate = event.allDay
      ? event.endTime.split('T')[0]
      : format(parseISO(event.endTime), 'yyyy-MM-dd');
    
    setNewEvent({
      title: event.title,
      description: event.description || '',
      startDate,
      endDate,
      startTime: event.allDay ? '09:00' : format(parseISO(event.startTime), 'HH:mm'),
      endTime: event.allDay ? '10:00' : format(parseISO(event.endTime), 'HH:mm'),
      attendees: event.attendees?.join(', ') || '',
      allDay: event.allDay || false,
      calendarId: event.calendarId || 'primary'
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateEvent = async () => {
    if (!selectedEvent) return;
    
    if (!newEvent.title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter an event title',
        variant: 'destructive'
      });
      return;
    }

    try {
      const attendeesList = newEvent.attendees
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      const success = await updateEvent(
        selectedEvent.calendarId || 'primary',
        selectedEvent.id,
        {
          title: newEvent.title,
          description: newEvent.description,
          startDate: newEvent.startDate,
          endDate: newEvent.endDate,
          startTime: newEvent.allDay ? undefined : newEvent.startTime,
          endTime: newEvent.allDay ? undefined : newEvent.endTime,
          attendees: attendeesList.length > 0 ? attendeesList : undefined,
          allDay: newEvent.allDay
        }
      );

      if (success) {
        toast({
          title: 'Event updated',
          description: 'Your event has been successfully updated'
        });
        setIsEditDialogOpen(false);
        setSelectedEvent(null);
        // Refetch events
        await fetchEvents();
      } else {
        toast({
          title: 'Failed to update event',
          description: error || 'Could not update the event',
          variant: 'destructive'
        });
      }
    } catch (err) {
      devLog('Error updating event:', err);
      toast({
        title: 'Error updating event',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
    }
  };

  const openDeleteDialog = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;

    try {
      const success = await deleteEvent(
        selectedEvent.calendarId || 'primary',
        selectedEvent.id
      );

      if (success) {
        toast({
          title: 'Event deleted',
          description: 'Your event has been successfully deleted'
        });
        setIsDeleteDialogOpen(false);
        setSelectedEvent(null);
        // Refetch events
        await fetchEvents();
      } else {
        toast({
          title: 'Failed to delete event',
          description: error || 'Could not delete the event',
          variant: 'destructive'
        });
      }
    } catch (err) {
      devLog('Error deleting event:', err);
      toast({
        title: 'Error deleting event',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
    }
  };

  const addCalendar = () => {
    const newId = `calendar-${Date.now()}`;
    const colorIndex = calendars.length % FALLBACK_COLORS.length;
    setCalendars([
      ...calendars,
      { id: newId, name: `Calendar ${calendars.length + 1}`, color: FALLBACK_COLORS[colorIndex], enabled: true },
    ]);
  };

  const removeCalendar = (id: string) => {
    if (id === 'primary') return;
    setCalendars(calendars.filter(c => c.id !== id));
  };

  const toggleCalendar = (id: string) => {
    const updatedCalendars = calendars.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c);
    setCalendars(updatedCalendars);
    saveCalendarPreferences(updatedCalendars);
  };

  const saveCalendarPreferences = (cals: CalendarSource[]) => {
    try {
      const prefs = {
        colors: cals.map(c => ({ id: c.id, color: c.color })),
        enabled: cals.map(c => ({ id: c.id, enabled: c.enabled }))
      };
      localStorage.setItem('calendar_preferences', JSON.stringify(prefs));
    } catch (err) {
      devLog('Error saving calendar preferences:', err);
    }
  };

  const updateCalendarName = (id: string, name: string) => {
    const updatedCalendars = calendars.map(c => c.id === id ? { ...c, name } : c);
    setCalendars(updatedCalendars);
    saveCalendarPreferences(updatedCalendars);
  };

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Pad to start on Sunday
  const startDay = monthStart.getDay();
  const paddedDays = Array(startDay).fill(null).concat(daysInMonth);

  // Optimized: Pre-compute events by date for better performance
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    
    // Filter by calendar and search query
    let filteredEvents = events;
    if (calendarFilter !== 'all') {
      filteredEvents = events.filter(e => e.calendarId === calendarFilter);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredEvents = filteredEvents.filter(event => {
        const titleMatch = event.title.toLowerCase().includes(query);
        const descriptionMatch = event.description?.toLowerCase().includes(query) ?? false;
        const attendeesMatch = event.attendees?.some(att => 
          att.toLowerCase().includes(query)
        ) ?? false;
        return titleMatch || descriptionMatch || attendeesMatch;
      });
    }
    
    // Group events by date
    filteredEvents.forEach(event => {
      try {
        const tz = event.calendarTimeZone || 'UTC';
        let dateKey: string;
        
        if (event.allDay) {
          dateKey = event.startTime.slice(0, 10);
        } else {
          const eventDate = parseISO(event.startTime);
          dateKey = formatInTimeZone(eventDate, tz, 'yyyy-MM-dd');
        }
        
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(event);
      } catch (err) {
        devLog('Error parsing event date:', err);
      }
    });
    
    // Sort each day's events once
    map.forEach(dayEvents => {
      dayEvents.sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime();
      });
    });
    
    return map;
  }, [events, calendarFilter, searchQuery]);

  const getEventsForDate = useCallback((date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return eventsByDate.get(dateKey) || [];
  }, [eventsByDate]);

  const selectedDateEvents = useMemo(() => getEventsForDate(selectedDate), [selectedDate, getEventsForDate]);

  const formatEventTime = (event: CalendarEvent) => {
    if (event.allDay) return 'All day';
    
    const start = parseISO(event.startTime);
    const end = parseISO(event.endTime);
    const duration = differenceInMinutes(end, start);
    const durationStr = duration >= 60 ? `${Math.floor(duration / 60)}h${duration % 60 > 0 ? ` ${duration % 60}m` : ''}` : `${duration}m`;
    
    let timeStr = `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')} (${durationStr})`;
    
    // Show timezone if different from user's local timezone
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const eventTz = event.calendarTimeZone;
    
    if (eventTz && eventTz !== userTz) {
      // Get short timezone abbreviation
      const tzAbbr = formatInTimeZone(start, eventTz, 'zzz');
      timeStr += ` ${tzAbbr}`;
    }
    
    return timeStr;
  };

  const getRelativeDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  if (isInitialLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-7 w-24" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="lg:col-span-2 h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center px-4 sm:px-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500" />
            </div>
            <CardTitle className="text-lg sm:text-xl">Google Account Not Connected</CardTitle>
            <CardDescription className="text-sm">
              To view and create events, please connect your Google account in Settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 px-4 sm:px-6">
            <Badge variant="outline" className="gap-1.5 bg-amber-500/10 text-amber-600 border-amber-500/30">
              <AlertCircle className="h-3.5 w-3.5" />
              Disconnected
            </Badge>
            <Button asChild className="mt-2 w-full sm:w-auto">
              <Link to="/settings">
                <Settings className="h-4 w-4 mr-2" />
                Go to Settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6" data-tour="calendar-content">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex items-start sm:items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Calendar</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">
              View and manage your events • Press <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">N</kbd> to create, <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">T</kbd> for today
            </p>
          </div>
          <Badge variant="outline" className="gap-1 h-6 sm:h-7 bg-green-500/10 text-green-600 border-green-500/30 text-xs shrink-0">
            <CheckCircle2 className="h-3 w-3" />
            <span className="hidden sm:inline">Connected</span>
          </Badge>
        </div>

        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Direct Google calendar view</p>
              <p className="text-xs text-muted-foreground">
                This page shows raw Google Calendar events. Accommodation availability and AI booking decisions use the merged model of in-app bookings plus synced external calendars.
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'shrink-0',
                syncHealth.status === 'fresh' && 'border-success/20 bg-success/10 text-success',
                syncHealth.status === 'warning' && 'border-warning/20 bg-warning/10 text-warning',
                syncHealth.status === 'stale' && 'border-destructive/20 bg-destructive/10 text-destructive',
                syncHealth.status === 'never-synced' && 'border-warning/20 bg-warning/10 text-warning',
                syncHealth.status === 'no-integrations' && 'border-border bg-background text-muted-foreground',
              )}
            >
              {syncHealth.status === 'fresh' && syncHealth.lastSyncTime
                ? `Merged sync fresh · ${formatDistanceToNow(syncHealth.lastSyncTime, { addSuffix: true })}`
                : syncHealth.status === 'warning' && syncHealth.lastSyncTime
                  ? `Merged sync delayed · ${formatDistanceToNow(syncHealth.lastSyncTime, { addSuffix: true })}`
                  : syncHealth.status === 'stale' && syncHealth.lastSyncTime
                    ? `Merged sync stale · ${formatDistanceToNow(syncHealth.lastSyncTime, { addSuffix: true })}`
                    : syncHealth.status === 'never-synced'
                      ? 'Merged sync pending'
                      : 'No linked room calendars'}
            </Badge>
          </CardContent>
        </Card>

        {/* Search Results Indicator */}
        {searchQuery && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 border border-blue-200">
            <span className="text-sm text-blue-800">
              Showing {Object.values(eventsByDate).flat().length} event{Object.values(eventsByDate).flat().length !== 1 ? 's' : ''} matching "{searchQuery}"
            </span>
            <button
              onClick={() => setSearchQuery('')}
              className="text-blue-600 hover:text-blue-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CalendarDays className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Events</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Sun className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.today}</p>
                <p className="text-xs text-muted-foreground">Today</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <CalendarClock className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.thisWeek}</p>
                <p className="text-xs text-muted-foreground">This Week</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.calendarsCount}</p>
                <p className="text-xs text-muted-foreground">Calendars</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9" 
                  onClick={async () => {
                    await syncCalendars(true);
                    fetchEvents();
                  }} 
                  disabled={isLoading || isCalendarSyncing}
                >
                  <RefreshCw className={cn("h-4 w-4", (isLoading || isCalendarSyncing) && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sync calendars (S)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9"
                  onClick={() => setIsShortcutsHelpOpen(true)}
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 text-xs sm:text-sm"
                  onClick={() => setIsExportDialogOpen(true)}
                >
                  <Download className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export to ICS format</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Calendar Filter */}
          {calendars.length > 1 && (
            <Select value={calendarFilter} onValueChange={setCalendarFilter}>
              <SelectTrigger className="h-9 w-[140px] sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2 shrink-0" />
                <SelectValue placeholder="All calendars" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All calendars</SelectItem>
                {calendars.filter(c => c.enabled).map(cal => (
                  <SelectItem key={cal.id} value={cal.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cal.color }} />
                      {cal.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Search Input */}
          <div className="relative hidden sm:block">
            <Input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-3 pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex-1" />

          <Dialog open={isCalendarManagerOpen} onOpenChange={setIsCalendarManagerOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-xs sm:text-sm">
                <Settings className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Manage</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manage Calendars</DialogTitle>
                <DialogDescription>Toggle calendars to show or hide their events.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-3">
                  {calendars.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No calendars found</p>
                    </div>
                  ) : (
                    calendars.map((calendar) => (
                      <div key={calendar.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                        <Checkbox 
                          checked={calendar.enabled} 
                          onCheckedChange={() => toggleCalendar(calendar.id)}
                          disabled={isRefetching}
                        />
                        <div 
                          className="w-3 h-3 rounded-full shrink-0" 
                          style={{ backgroundColor: calendar.color }}
                        />
                        <Input
                          value={calendar.name}
                          onChange={(e) => updateCalendarName(calendar.id, e.target.value)}
                          className="flex-1 h-8"
                          disabled={isRefetching}
                        />
                        {calendar.id !== 'primary' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => removeCalendar(calendar.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <div className="text-sm text-muted-foreground flex-1">
                  Calendars are synced from your Google Calendar account
                </div>
                <Button variant="outline" onClick={() => setIsCalendarManagerOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">New Event</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Event</DialogTitle>
                <DialogDescription>Add a new event to your calendar.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="Event title"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="Event description"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={newEvent.startDate}
                      onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="startTime">Start Time *</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={newEvent.startTime}
                      onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="endDate">End Date *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={newEvent.endDate}
                      onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endTime">End Time *</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={newEvent.endTime}
                      onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="attendees">Attendees (comma-separated emails)</Label>
                  <Input
                    id="attendees"
                    value={newEvent.attendees}
                    onChange={(e) => setNewEvent({ ...newEvent, attendees: e.target.value })}
                    placeholder="email1@example.com, email2@example.com"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateEvent} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : 'Create Event'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Event Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Event</DialogTitle>
                <DialogDescription>
                  Update your calendar event
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-title">Title*</Label>
                  <Input
                    id="edit-title"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="Event title"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Input
                    id="edit-description"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="Event description (optional)"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-all-day"
                    checked={newEvent.allDay}
                    onCheckedChange={(checked) => setNewEvent({ ...newEvent, allDay: checked === true })}
                  />
                  <Label htmlFor="edit-all-day" className="cursor-pointer">All-day event</Label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-start-date">Start Date*</Label>
                    <Input
                      id="edit-start-date"
                      type="date"
                      value={newEvent.startDate}
                      onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })}
                    />
                  </div>
                  {!newEvent.allDay && (
                    <div className="grid gap-2">
                      <Label htmlFor="edit-start-time">Start Time*</Label>
                      <Input
                        id="edit-start-time"
                        type="time"
                        value={newEvent.startTime}
                        onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                      />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-end-date">End Date*</Label>
                    <Input
                      id="edit-end-date"
                      type="date"
                      value={newEvent.endDate}
                      onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
                    />
                  </div>
                  {!newEvent.allDay && (
                    <div className="grid gap-2">
                      <Label htmlFor="edit-end-time">End Time*</Label>
                      <Input
                        id="edit-end-time"
                        type="time"
                        value={newEvent.endTime}
                        onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                      />
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-attendees">Attendees (comma-separated emails)</Label>
                  <Input
                    id="edit-attendees"
                    value={newEvent.attendees}
                    onChange={(e) => setNewEvent({ ...newEvent, attendees: e.target.value })}
                    placeholder="email1@example.com, email2@example.com"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleUpdateEvent} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Update Event
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Event Confirmation Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Event</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete "{selectedEvent?.title}"? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDeleteEvent} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Event
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card 
          className="lg:col-span-2 relative"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {isRefetching && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
              <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-lg border shadow-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">Updating calendar...</span>
              </div>
            </div>
          )}
          <CardHeader className="pb-2 px-3 sm:px-6">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base sm:text-lg">{format(currentMonth, 'MMMM yyyy')}</CardTitle>
              <div className="flex gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Previous month</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3" onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }}>
                  Today
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Next month</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <p className="text-xs text-muted-foreground sm:hidden mt-1">Swipe left/right to change month</p>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <div key={i} className="text-center text-xs sm:text-sm font-medium text-muted-foreground py-1 sm:py-2">
                  <span className="sm:hidden">{day}</span>
                  <span className="hidden sm:inline">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</span>
                </div>
              ))}
            </div>
            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {paddedDays.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }
                const dayEvents = getEventsForDate(day);
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentDay = isSameDay(day, new Date());
                const hasAllDayEvent = dayEvents.some(e => e.allDay);
                
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    onDoubleClick={() => openCreateDialogWithDate(day)}
                    className={cn(
                      "aspect-square p-0.5 sm:p-1 rounded-md sm:rounded-lg border border-transparent transition-all active:scale-95 touch-manipulation relative group",
                      isSelected && "border-primary bg-primary/10 ring-1 ring-primary",
                      isCurrentDay && !isSelected && "bg-accent",
                      !isSameMonth(day, currentMonth) && "text-muted-foreground opacity-50"
                    )}
                  >
                    <div className={cn(
                      "text-xs sm:text-sm font-medium",
                      isCurrentDay && "text-primary font-bold"
                    )}>
                      {format(day, 'd')}
                    </div>
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5 justify-center mt-0.5 sm:mt-1">
                        {hasAllDayEvent && (
                          <div className="w-full h-1 sm:h-1.5 rounded-full bg-primary/30 absolute bottom-1 left-1 right-1" />
                        )}
                        {dayEvents.filter(e => !e.allDay).slice(0, 3).map((evt, i) => {
                          const calColor = calendars.find(c => c.id === evt.calendarId)?.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length];
                          return (
                            <div
                              key={i}
                              className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full"
                              style={{ backgroundColor: calColor }}
                            />
                          );
                        })}
                      </div>
                    )}
                    {/* Quick add indicator on hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <Plus className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Events Panel */}
        <Card>
          <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg">
                  {getRelativeDateLabel(selectedDate)}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? 's' : ''}
                  {calendarFilter !== 'all' && ' (filtered)'}
                </CardDescription>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => openCreateDialogWithDate(selectedDate)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add event on this day</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <ScrollArea className="h-[250px] sm:h-[400px]">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : selectedDateEvents.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                    <CalendarIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">No events on this day</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => openCreateDialogWithDate(selectedDate)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Event
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {selectedDateEvents.map((event) => {
                    const eventCalendar = calendars.find(c => c.id === event.calendarId);
                    const eventColor = eventCalendar?.color || FALLBACK_COLORS[0];
                    
                    return (
                      <TooltipProvider key={event.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "p-2 sm:p-3 rounded-lg border border-border bg-card hover:bg-accent/50 active:bg-accent transition-colors touch-manipulation cursor-pointer",
                                event.allDay && "bg-primary/5 border-primary/20"
                              )}
                            >
                              <div className="flex items-start gap-2">
                                <div
                                  className="w-1 h-full min-h-[40px] rounded-full shrink-0"
                                  style={{ backgroundColor: eventColor }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-medium text-foreground truncate">{event.title}</h4>
                                    {event.isRecurringEvent && (
                                      <Badge variant="secondary" className="text-xs gap-1">
                                        <Repeat className="h-3 w-3" />
                                        Recurring
                                      </Badge>
                                    )}
                                    {event.allDay && (
                                      <Badge variant="secondary" className="text-xs">
                                        All day
                                      </Badge>
                                    )}
                                    {event.calendarName && (
                                      <Badge variant="outline" className="text-xs shrink-0">
                                        {event.calendarName}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                                    <Clock className="h-3 w-3" />
                                    {formatEventTime(event)}
                                  </div>
                                  {event.description && (
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                                  )}
                                  {event.attendees && event.attendees.length > 0 && (
                                    <div className="flex items-center gap-1.5 mt-2">
                                      <Users className="h-3 w-3 text-muted-foreground" />
                                      <div className="flex flex-wrap gap-1">
                                        {event.attendees.slice(0, 2).map((attendee, i) => (
                                          <Badge key={i} variant="secondary" className="text-xs">
                                            {attendee}
                                          </Badge>
                                        ))}
                                        {event.attendees.length > 2 && (
                                          <Badge variant="secondary" className="text-xs">
                                            +{event.attendees.length - 2} more
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col gap-1 ml-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-primary/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditDialog(event);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-destructive/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDeleteDialog(event);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            <div className="space-y-1">
                              <p className="font-medium">{event.title}</p>
                              {event.calendarName && (
                                <p className="text-xs text-muted-foreground">
                                  Calendar: {event.calendarName}
                                </p>
                              )}
                              {event.description && (
                                <p className="text-xs">{event.description}</p>
                              )}
                              <p className="text-xs text-muted-foreground">Double-click calendar to quick-add</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Events & Calendar Legend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming Events */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
              <Badge variant="secondary" className="text-xs">{stats.upcoming.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {stats.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming events</p>
            ) : (
              <div className="space-y-2">
                {stats.upcoming.map((event) => {
                  const eventDate = parseISO(event.startTime);
                  const eventCalendar = calendars.find(c => c.id === event.calendarId);
                  const eventColor = eventCalendar?.color || FALLBACK_COLORS[0];
                  
                  return (
                    <div 
                      key={event.id} 
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedDate(eventDate);
                        setCurrentMonth(startOfMonth(eventDate));
                      }}
                    >
                      <div className="w-1 h-8 rounded-full" style={{ backgroundColor: eventColor }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {getRelativeDateLabel(eventDate)} • {event.allDay ? 'All day' : format(eventDate, 'h:mm a')}
                        </p>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendar Legend */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Active Calendars</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs"
                onClick={() => setIsCalendarManagerOpen(true)}
              >
                Manage
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {calendars.filter(c => c.enabled).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No calendars enabled</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {calendars.filter(c => c.enabled).map((calendar) => (
                  <div 
                    key={calendar.id} 
                    className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-colors",
                      calendarFilter === calendar.id ? "bg-accent" : "hover:bg-accent/50"
                    )}
                    onClick={() => setCalendarFilter(calendarFilter === calendar.id ? 'all' : calendar.id)}
                  >
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: calendar.color }}
                    />
                    <span className="text-sm text-muted-foreground">{calendar.name}</span>
                    {calendarFilter === calendar.id && (
                      <X className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog 
        isOpen={isShortcutsHelpOpen} 
        onOpenChange={setIsShortcutsHelpOpen}
      />

      {/* Export Dialog */}
      <ExportDialog
        isOpen={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        events={events}
        selectedDate={selectedDate}
      />
    </div>
  );
}

export default function CalendarPage() {
  return (
    <ErrorBoundary fullPage>
      <CalendarPageContent />
    </ErrorBoundary>
  );
}