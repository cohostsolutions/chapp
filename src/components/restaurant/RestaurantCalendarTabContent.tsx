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
  ShoppingBag,
  Clock,
  Plus,
  CalendarDays,
  CalendarRange,
  User,
  Phone,
  Loader2,
  Truck,
  Package
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
import type { useOrdersData, InternalCalendarEvent, CalendarSyncEvent, PrepTask } from '@/hooks/useOrdersData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { prepTaskStatusConfig } from '@/lib/orderPrep';

type ViewMode = 'month' | 'week';

interface RestaurantCalendarTabContentProps {
  ordersData: ReturnType<typeof useOrdersData>;
}

interface DayEvents {
  orders: Array<{
    id: string;
    pickup_time: string;
    pickup_name: string | null;
    status: string;
    total_amount: number | null;
    lead?: { name: string } | null;
  }>;
  calendarEvents: InternalCalendarEvent[];
  syncedEvents: CalendarSyncEvent[];
  prepTasks: PrepTask[];
}

const statusColors: Record<string, string> = {
  pending: 'bg-warning/80 border-warning',
  confirmed: 'bg-info/80 border-info',
  preparing: 'bg-primary/80 border-primary',
  ready: 'bg-success/80 border-success',
  picked_up: 'bg-muted border-muted-foreground/30',
  cancelled: 'bg-destructive/30 border-destructive/30',
};

export default function RestaurantCalendarTabContent({ ordersData }: RestaurantCalendarTabContentProps) {
  const { orders, calendarEvents, syncedEvents, prepTasks, refetchAll } = ordersData;
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
    
    // Orders with pickup time on this day
    const dayOrders = orders.filter(order => {
      if (!order.pickup_time) return false;
      return format(parseISO(order.pickup_time), 'yyyy-MM-dd') === dayStr;
    }).map(order => ({
      id: order.id,
      pickup_time: order.pickup_time!,
      pickup_name: order.pickup_name,
      status: order.status,
      total_amount: order.total_amount,
      lead: order.lead,
    }));
    
    // Internal calendar events on this day
    const dayCalendarEvents = calendarEvents.filter(event => {
      return format(parseISO(event.start_time), 'yyyy-MM-dd') === dayStr;
    });
    
    // Synced calendar events on this day
    const daySyncedEvents = syncedEvents.filter(event => {
      return format(parseISO(event.start_time), 'yyyy-MM-dd') === dayStr;
    });

    const dayPrepTasks = prepTasks.filter(task => {
      if (!task.scheduled_start_time) return false;
      return format(parseISO(task.scheduled_start_time), 'yyyy-MM-dd') === dayStr;
    });
    
    return {
      orders: dayOrders,
      calendarEvents: dayCalendarEvents,
      syncedEvents: daySyncedEvents,
      prepTasks: dayPrepTasks,
    };
  }, [orders, calendarEvents, syncedEvents, prepTasks]);

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
        event_type: 'delivery',
      });

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
    ? selectedDayEvents.orders.length + selectedDayEvents.calendarEvents.length + selectedDayEvents.syncedEvents.length
    : 0;

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
              const totalEvents = events.orders.length + events.calendarEvents.length + events.syncedEvents.length + events.prepTasks.length;
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
                    {events.orders.slice(0, 2).map(order => (
                      <div
                        key={order.id}
                        className={cn(
                          "text-[10px] sm:text-xs px-1 py-0.5 rounded truncate text-white",
                          statusColors[order.status] || 'bg-muted'
                        )}
                        title={order.pickup_name || order.lead?.name || 'Order'}
                      >
                        <ShoppingBag className="w-3 h-3 inline mr-1" />
                        {order.pickup_name || order.lead?.name || 'Order'}
                      </div>
                    ))}
                    
                    {events.calendarEvents.slice(0, viewMode === 'week' ? 3 : 1).map(event => (
                      <div
                        key={event.id}
                        className="text-[10px] sm:text-xs px-1 py-0.5 rounded truncate bg-info/80 text-white"
                        title={event.title}
                      >
                        <Calendar className="w-3 h-3 inline mr-1" />
                        {event.title}
                      </div>
                    ))}
                    
                    {events.syncedEvents.slice(0, viewMode === 'week' ? 2 : 1).map(event => (
                      <div
                        key={event.id}
                        className="text-[10px] sm:text-xs px-1 py-0.5 rounded truncate bg-orange-500/80 text-white"
                        title={event.title || 'External Event'}
                      >
                        <Truck className="w-3 h-3 inline mr-1" />
                        {event.title || 'External'}
                      </div>
                    ))}

                    {events.prepTasks.slice(0, viewMode === 'week' ? 2 : 1).map(task => (
                      <div
                        key={task.id}
                        className="text-[10px] sm:text-xs px-1 py-0.5 rounded truncate bg-primary/80 text-white"
                        title={`${task.prep_item_name} prep`}
                      >
                        <ChefHat className="w-3 h-3 inline mr-1" />
                        {task.prep_item_name}
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
          <div className="w-3 h-3 rounded bg-warning/80" />
          <span>Pending Order</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-success/80" />
          <span>Ready Order</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-info/80" />
          <span>Calendar Event</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-primary/80" />
          <span>Prep Block</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-orange-500/80" />
          <span>External Event</span>
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
              {totalSelectedDayItems} item{totalSelectedDayItems !== 1 ? 's' : ''} scheduled
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-4">
              {/* Orders */}
              {selectedDayEvents?.orders && selectedDayEvents.orders.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-warning" />
                    Orders ({selectedDayEvents.orders.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedDayEvents.orders.map(order => (
                      <Card key={order.id} className="glass">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">
                                {order.pickup_name || order.lead?.name || 'Customer'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                <Clock className="w-3 h-3 inline mr-1" />
                                {format(parseISO(order.pickup_time), 'h:mm a')}
                              </p>
                            </div>
                            <Badge variant="outline" className={cn('text-xs text-white', statusColors[order.status])}>
                              {order.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Calendar Events */}
              {selectedDayEvents?.calendarEvents && selectedDayEvents.calendarEvents.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-info" />
                    Events ({selectedDayEvents.calendarEvents.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedDayEvents.calendarEvents.map(event => (
                      <Card key={event.id} className="glass">
                        <CardContent className="p-3">
                          <p className="font-medium text-sm">{event.title}</p>
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
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {selectedDayEvents?.prepTasks && selectedDayEvents.prepTasks.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <ChefHat className="w-4 h-4 text-primary" />
                    Prep Tasks ({selectedDayEvents.prepTasks.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedDayEvents.prepTasks.map(task => (
                      <Card key={task.id} className="glass">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-sm">{task.quantity}x {task.prep_item_name}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                <Clock className="w-3 h-3 inline mr-1" />
                                {task.scheduled_start_time ? format(parseISO(task.scheduled_start_time), 'h:mm a') : 'Not set'} - {task.scheduled_ready_time ? format(parseISO(task.scheduled_ready_time), 'h:mm a') : 'Not set'}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Reminder: {task.reminder_time ? format(parseISO(task.reminder_time), 'h:mm a') : 'Not set'}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge variant="outline" className={prepTaskStatusConfig[task.status]?.tone || prepTaskStatusConfig.scheduled.tone}>
                                {prepTaskStatusConfig[task.status]?.label || task.status}
                              </Badge>
                              {task.manual_override && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Manual override
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
                    <Truck className="w-4 h-4 text-orange-500" />
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
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No orders or events scheduled for this day</p>
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
              Add Event
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
              New Calendar Event
            </DialogTitle>
            <DialogDescription>
              Add a delivery schedule or event to your calendar
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Event Title *</Label>
              <Input
                placeholder="e.g., Catering Delivery"
                value={newEvent.title}
                onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
              />
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
              <Label>Description</Label>
              <Textarea
                placeholder="Add any notes or details..."
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
                  Create Event
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
