import { useState, useMemo, useCallback } from 'react';
import { devError } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  Plus,
  CalendarDays,
  CalendarRange,
  User,
  Phone,
  Mail,
  Loader2,
  Briefcase,
  Target
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths,
  parseISO,
  startOfWeek,
  endOfWeek,
  isToday,
  isBefore,
  addDays,
  addWeeks,
  subWeeks
} from 'date-fns';
import { cn } from '@/lib/utils';
import type { useSalesData, InternalCalendarEvent, CalendarSyncEvent } from '@/hooks/useSalesData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

type ViewMode = 'month' | 'week';

interface SalesCalendarTabContentProps {
  salesData: ReturnType<typeof useSalesData>;
}

interface DayEvents {
  calendarEvents: InternalCalendarEvent[];
  syncedEvents: CalendarSyncEvent[];
}

const appointmentStatusConfig: Record<string, string> = {
  requested: 'bg-warning/15 text-warning border-warning/30',
  confirmed: 'bg-success/15 text-success border-success/30',
  completed: 'bg-muted text-muted-foreground border-muted',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
  no_show: 'bg-destructive/15 text-destructive border-destructive/30',
};

const eventTypeColors: Record<string, string> = {
  meeting: 'bg-primary/80 border-primary',
  call: 'bg-info/80 border-info',
  demo: 'bg-success/80 border-success',
  followup: 'bg-warning/80 border-warning',
  appointment: 'bg-violet-500/80 border-violet-500',
  default: 'bg-muted border-muted-foreground/30',
};

export default function SalesCalendarTabContent({ salesData }: SalesCalendarTabContentProps) {
  const { leads, calendarEvents, syncedEvents, refetchAll } = salesData;
  const { toast } = useToast();
  const { profile } = useAuth();
  
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayDialog, setShowDayDialog] = useState(false);
  const [showNewEventDialog, setShowNewEventDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // New event form state
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: new Date(),
    startTime: '09:00',
    endTime: '10:00',
    allDay: false,
    eventType: 'appointment',
    relatedLeadId: '',
    appointmentStatus: 'confirmed',
  });

  // Navigation handlers
  const goToPrevious = useCallback(() => {
    if (viewMode === 'month') {
      setCurrentDate(prev => subMonths(prev, 1));
    } else {
      setCurrentDate(prev => subWeeks(prev, 1));
    }
  }, [viewMode]);

  const goToNext = useCallback(() => {
    if (viewMode === 'month') {
      setCurrentDate(prev => addMonths(prev, 1));
    } else {
      setCurrentDate(prev => addWeeks(prev, 1));
    }
  }, [viewMode]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Calculate calendar days
  const calendarDays = useMemo(() => {
    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
  }, [currentDate, viewMode]);

  // Get events for a specific day
  const getEventsForDay = useCallback((day: Date): DayEvents => {
    const dayStr = format(day, 'yyyy-MM-dd');
    
    // Internal calendar events on this day
    const dayCalendarEvents = calendarEvents.filter(event => {
      return format(parseISO(event.start_time), 'yyyy-MM-dd') === dayStr;
    });
    
    // Synced calendar events on this day
    const daySyncedEvents = syncedEvents.filter(event => {
      return format(parseISO(event.start_time), 'yyyy-MM-dd') === dayStr;
    });
    
    return {
      calendarEvents: dayCalendarEvents,
      syncedEvents: daySyncedEvents,
    };
  }, [calendarEvents, syncedEvents]);

  // Handle day click
  const handleDayClick = useCallback((day: Date) => {
    setSelectedDate(day);
    setShowDayDialog(true);
  }, []);

  // Handle new event creation
  const handleCreateEvent = useCallback(async () => {
    if (!profile?.organization_id || !newEvent.title.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an event title',
        variant: 'destructive',
      });
      return;
    }

    if (!newEvent.relatedLeadId) {
      toast({
        title: 'Lead Required',
        description: 'Jay appointments must always be tied to a lead.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const startDateTime = newEvent.allDay 
        ? format(newEvent.date, 'yyyy-MM-dd') + 'T00:00:00'
        : format(newEvent.date, 'yyyy-MM-dd') + 'T' + newEvent.startTime + ':00';
      
      const endDateTime = newEvent.allDay 
        ? format(addDays(newEvent.date, 1), 'yyyy-MM-dd') + 'T00:00:00'
        : format(newEvent.date, 'yyyy-MM-dd') + 'T' + newEvent.endTime + ':00';

      const { error } = await supabase.from('calendar_events').insert({
        organization_id: profile.organization_id,
        user_id: profile.id,
        title: newEvent.title.trim(),
        description: newEvent.description.trim() || null,
        start_time: startDateTime,
        end_time: endDateTime,
        all_day: newEvent.allDay,
        event_type: newEvent.eventType,
        related_lead_id: newEvent.relatedLeadId,
        appointment_status: newEvent.appointmentStatus,
        appointment_source: 'manual',
      } as any);

      if (error) throw error;

      toast({
        title: 'Event Created',
        description: 'Calendar event has been added successfully',
      });

      setShowNewEventDialog(false);
      setNewEvent({
        title: '',
        description: '',
        date: new Date(),
        startTime: '09:00',
        endTime: '10:00',
        allDay: false,
        eventType: 'appointment',
        relatedLeadId: '',
        appointmentStatus: 'confirmed',
      });
      await refetchAll();
    } catch (err) {
      devError('Failed to create event:', err);
      toast({
        title: 'Error',
        description: 'Failed to create event',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  }, [newEvent, profile, toast, refetchAll]);

  // Get selected day events
  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate) : null;
  const totalSelectedDayItems = selectedDayEvents 
    ? selectedDayEvents.calendarEvents.length + selectedDayEvents.syncedEvents.length
    : 0;

  // Get event type icon
  const getEventTypeIcon = (eventType: string | null) => {
    switch (eventType) {
      case 'meeting': return <Users className="w-3 h-3" />;
      case 'call': return <Phone className="w-3 h-3" />;
      case 'demo': return <Briefcase className="w-3 h-3" />;
      case 'followup': return <Target className="w-3 h-3" />;
      default: return <Calendar className="w-3 h-3" />;
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-auto">
      {/* Header Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevious}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={goToNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold ml-2">
            {viewMode === 'month' 
              ? format(currentDate, 'MMMM yyyy')
              : `Week of ${format(startOfWeek(currentDate), 'MMM d, yyyy')}`
            }
          </h2>
        </div>
        
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)}>
            <ToggleGroupItem value="month" size="sm">
              <CalendarDays className="w-4 h-4 mr-1" />
              Month
            </ToggleGroupItem>
            <ToggleGroupItem value="week" size="sm">
              <CalendarRange className="w-4 h-4 mr-1" />
              Week
            </ToggleGroupItem>
          </ToggleGroup>
          
          <Button variant="glow" size="sm" onClick={() => setShowNewEventDialog(true)}>
            <Plus className="w-4 h-4 mr-1" />
            New Event
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="glass flex-1">
        <CardContent className="p-2 sm:p-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
          <div className={cn(
            "grid grid-cols-7 gap-1",
            viewMode === 'week' ? 'min-h-[200px]' : ''
          )}>
            {calendarDays.map(day => {
              const events = getEventsForDay(day);
              const totalEvents = events.calendarEvents.length + events.syncedEvents.length;
              const isCurrentMonth = viewMode === 'month' ? day.getMonth() === currentDate.getMonth() : true;
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 border rounded-lg cursor-pointer transition-all hover:border-primary/50",
                    isToday(day) && "border-primary bg-primary/5",
                    !isCurrentMonth && "opacity-40 bg-muted/30",
                    isSelected && "ring-2 ring-primary",
                    viewMode === 'week' && "min-h-[150px]"
                  )}
                >
                  <div className={cn(
                    "text-sm font-medium mb-1",
                    isToday(day) && "text-primary"
                  )}>
                    {format(day, 'd')}
                  </div>
                  
                  {/* Event indicators */}
                  <div className="space-y-1">
                    {events.calendarEvents.slice(0, viewMode === 'week' ? 4 : 2).map(event => (
                      <div
                        key={event.id}
                        className={cn(
                          "text-[10px] sm:text-xs px-1 py-0.5 rounded truncate text-white flex items-center gap-1",
                          eventTypeColors[event.event_type || 'default'] || eventTypeColors.default
                        )}
                        title={event.title}
                      >
                        {getEventTypeIcon(event.event_type)}
                        <span className="truncate">{event.title}</span>
                      </div>
                    ))}
                    
                    {events.syncedEvents.slice(0, viewMode === 'week' ? 2 : 1).map(event => (
                      <div
                        key={event.id}
                        className="text-[10px] sm:text-xs px-1 py-0.5 rounded truncate bg-orange-500/80 text-white flex items-center gap-1"
                        title={event.title || 'External Event'}
                      >
                        <Calendar className="w-3 h-3" />
                        <span className="truncate">{event.title || 'External'}</span>
                      </div>
                    ))}
                    
                    {totalEvents > (viewMode === 'week' ? 6 : 3) && (
                      <div className="text-[10px] text-muted-foreground">
                        +{totalEvents - (viewMode === 'week' ? 6 : 3)} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-primary/80" />
          <span>Meeting</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-info/80" />
          <span>Call</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-success/80" />
          <span>Demo</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-warning/80" />
          <span>Follow-up</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-orange-500/80" />
          <span>External</span>
        </div>
      </div>

      {/* Day Details Dialog */}
      <Dialog open={showDayDialog} onOpenChange={setShowDayDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
            <DialogDescription>
              {totalSelectedDayItems} appointment{totalSelectedDayItems !== 1 ? 's' : ''} scheduled
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-4">
              {/* Calendar Events */}
              {selectedDayEvents?.calendarEvents && selectedDayEvents.calendarEvents.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Appointments ({selectedDayEvents.calendarEvents.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedDayEvents.calendarEvents.map(event => (
                      <Card key={event.id} className="glass">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-sm flex items-center gap-2">
                                {getEventTypeIcon(event.event_type)}
                                {event.title}
                              </p>
                              {event.description && (
                                <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                <Clock className="w-3 h-3 inline mr-1" />
                                {event.all_day 
                                  ? 'All day'
                                  : `${format(parseISO(event.start_time), 'h:mm a')} - ${format(parseISO(event.end_time), 'h:mm a')}`
                                }
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge 
                                variant="outline" 
                                className={cn('text-xs text-white', eventTypeColors[event.event_type || 'default'])}
                              >
                                {event.event_type || 'Event'}
                              </Badge>
                              {event.appointment_status && (
                                <Badge variant="outline" className={appointmentStatusConfig[event.appointment_status] || appointmentStatusConfig.confirmed}>
                                  {event.appointment_status.replace('_', ' ')}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Synced Events */}
              {selectedDayEvents?.syncedEvents && selectedDayEvents.syncedEvents.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-orange-500" />
                    External Events ({selectedDayEvents.syncedEvents.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedDayEvents.syncedEvents.map(event => (
                      <Card key={event.id} className="glass">
                        <CardContent className="p-3">
                          <p className="font-medium text-sm">{event.title || 'External Event'}</p>
                          {event.guest_name && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <User className="w-3 h-3 inline mr-1" />
                              {event.guest_name}
                            </p>
                          )}
                          {event.guest_email && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <Mail className="w-3 h-3 inline mr-1" />
                              {event.guest_email}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {event.all_day 
                              ? 'All day'
                              : `${format(parseISO(event.start_time), 'h:mm a')} - ${format(parseISO(event.end_time), 'h:mm a')}`
                            }
                          </p>
                          {event.source_platform && (
                            <Badge variant="secondary" className="text-xs mt-2">
                              {event.source_platform}
                            </Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              
              {totalSelectedDayItems === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No appointments scheduled for this day</p>
                </div>
              )}
            </div>
          </ScrollArea>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDayDialog(false)}>
              Close
            </Button>
            <Button 
              variant="glow" 
              onClick={() => {
                setNewEvent(prev => ({ ...prev, date: selectedDate || new Date() }));
                setShowDayDialog(false);
                setShowNewEventDialog(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Event Dialog */}
      <Dialog open={showNewEventDialog} onOpenChange={setShowNewEventDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              New Appointment
            </DialogTitle>
            <DialogDescription>
              Schedule a meeting, call, or follow-up with a lead
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="e.g., Product Demo with John"
                value={newEvent.title}
                onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Event Type</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={newEvent.eventType}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, eventType: e.target.value }))}
                >
                  <option value="meeting">Meeting</option>
                  <option value="call">Call</option>
                  <option value="demo">Demo</option>
                  <option value="followup">Follow-up</option>
                  <option value="appointment">Appointment</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <Label>Related Lead *</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={newEvent.relatedLeadId}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, relatedLeadId: e.target.value }))}
                >
                  <option value="">Select lead</option>
                  {leads.slice(0, 50).map(lead => (
                    <option key={lead.id} value={lead.id}>{lead.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Appointment Status</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={newEvent.appointmentStatus}
                onChange={(e) => setNewEvent(prev => ({ ...prev, appointmentStatus: e.target.value }))}
              >
                <option value="requested">Requested</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Managed appointment statuses are used for Jay calendar management and reporting. Synced Google events still appear separately as external busy blocks.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {format(newEvent.date, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[60]">
                  <CalendarPicker
                    mode="single"
                    selected={newEvent.date}
                    onSelect={(date) => date && setNewEvent(prev => ({ ...prev, date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allDay"
                checked={newEvent.allDay}
                onChange={(e) => setNewEvent(prev => ({ ...prev, allDay: e.target.checked }))}
                className="rounded border-input"
              />
              <Label htmlFor="allDay" className="cursor-pointer">All day event</Label>
            </div>
            
            {!newEvent.allDay && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Add meeting agenda or notes..."
                value={newEvent.description}
                onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewEventDialog(false)}>
              Cancel
            </Button>
            <Button variant="glow" onClick={handleCreateEvent} disabled={isCreating || !newEvent.title.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1" />
                  Create Appointment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
