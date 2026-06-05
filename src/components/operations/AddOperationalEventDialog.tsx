import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Calendar, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  ResponsiveDialog,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@/components/shared/ResponsiveDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { CreateMaintenanceBlockInput } from '@/hooks/useMaintenanceBlocks';

interface RoomUnit {
  id: string;
  name: string;
}

export type EventType = 'maintenance' | 'general';

export interface CreateOperationalEventInput {
  type: EventType;
  title: string;
  description?: string;
  // Maintenance specific
  room_unit_id?: string;
  reason?: string | null;
  start_date: string;
  end_date: string;
  is_recurring?: boolean;
  recurrence_pattern?: 'weekly' | 'monthly' | 'yearly' | null;
  recurrence_day_of_week?: number | null;
  recurrence_day_of_month?: number | null;
  // General event specific
  start_time?: string;
  end_time?: string;
  all_day?: boolean;
}

interface AddOperationalEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitMaintenance?: (data: CreateMaintenanceBlockInput) => Promise<any>;
  onSubmitGeneralEvent?: (data: {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    allDay: boolean;
  }) => Promise<any>;
  roomUnits: RoomUnit[];
  saving: boolean;
  defaultDate?: Date;
  isCalendarConnected?: boolean;
  supportedEventTypes?: EventType[];
}

const MAINTENANCE_REASONS = [
  'Cleaning',
  'Repairs',
  'Renovation',
  'Pest Control',
  'Deep Cleaning',
  'HVAC Maintenance',
  'Plumbing',
  'Electrical',
  'Painting',
  'Furniture Replacement',
  'Other',
];

export function AddOperationalEventDialog({
  open,
  onOpenChange,
  onSubmitMaintenance,
  onSubmitGeneralEvent,
  roomUnits,
  saving,
  defaultDate,
  isCalendarConnected = false,
  supportedEventTypes,
}: AddOperationalEventDialogProps) {
  const [eventType, setEventType] = useState<EventType>('maintenance');
  const maintenanceSupported = supportedEventTypes ? supportedEventTypes.includes('maintenance') : true;
  const generalSupported = supportedEventTypes ? supportedEventTypes.includes('general') : true;
  
  // Common fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  
  // Maintenance specific
  const [roomUnitId, setRoomUnitId] = useState<string | undefined>(undefined);
  const [reason, setReason] = useState<string | undefined>(undefined);
  const [customReason, setCustomReason] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  
  // General event specific
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [allDay, setAllDay] = useState(false);

  useEffect(() => {
    if (open) {
      const initialDate = defaultDate || new Date();
      setEventType(maintenanceSupported && roomUnits.length > 0 ? 'maintenance' : 'general');
      setTitle('');
      setDescription('');
      setStartDate(initialDate);
      setEndDate(initialDate);
      setRoomUnitId(undefined);
      setReason(undefined);
      setCustomReason('');
      setIsRecurring(false);
      setRecurrencePattern('weekly');
      setStartTime('09:00');
      setEndTime('10:00');
      setAllDay(false);
    }
  }, [open, defaultDate, roomUnits.length, maintenanceSupported]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (eventType === 'maintenance') {
      if (!onSubmitMaintenance) return;
      const finalReason = reason === 'Other' ? customReason : (reason || null);
      if (!roomUnitId) return;
      const result = await onSubmitMaintenance({
        room_unit_id: roomUnitId,
        title: title || 'Maintenance',
        reason: finalReason || null,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? recurrencePattern : null,
        recurrence_day_of_week: isRecurring && recurrencePattern === 'weekly' ? startDate.getDay() : null,
        recurrence_day_of_month: isRecurring && recurrencePattern === 'monthly' ? startDate.getDate() : null,
      });
      if (result) {
        onOpenChange(false);
      }
    } else {
      if (!onSubmitGeneralEvent) return;
      // General calendar event
      const startDateTime = allDay 
        ? `${format(startDate, 'yyyy-MM-dd')}T00:00:00` 
        : `${format(startDate, 'yyyy-MM-dd')}T${startTime}:00`;
      const endDateTime = allDay 
        ? `${format(startDate, 'yyyy-MM-dd')}T23:59:59` 
        : `${format(startDate, 'yyyy-MM-dd')}T${endTime}:00`;

      await onSubmitGeneralEvent({
        title,
        description: description || undefined,
        startTime: startDateTime,
        endTime: endDateTime,
        allDay,
      });
      onOpenChange(false);
    }
  };

  const hasInvalidGeneralTimeRange = eventType === 'general' && !allDay && endTime <= startTime;

  const canSubmit = eventType === 'maintenance'
    ? !!roomUnitId && maintenanceSupported && !!onSubmitMaintenance
    : title.trim() !== '' && isCalendarConnected && generalSupported && !!onSubmitGeneralEvent && !hasInvalidGeneralTimeRange;

  const showTabs = maintenanceSupported && generalSupported && roomUnits.length > 0 && isCalendarConnected;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} showCloseButton={false}>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          {eventType === 'maintenance' ? (
            <>
              <Wrench className="w-5 h-5 text-warning" />
              Add Event
            </>
          ) : (
            <>
              <Calendar className="w-5 h-5 text-primary" />
              Add Event
            </>
          )}
        </ResponsiveDialogTitle>
      </ResponsiveDialogHeader>

      <ResponsiveDialogBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Event Type Tabs - only show if both options available */}
          {showTabs && (
            <Tabs value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="maintenance" className="flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Block Room
                </TabsTrigger>
                <TabsTrigger value="general" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Calendar Event
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {eventType === 'maintenance' ? (
            <>
              {/* Room Selection */}
              <div className="space-y-2">
                <Label>Room / Unit *</Label>
                <Select value={roomUnitId} onValueChange={setRoomUnitId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select room to block" />
                  </SelectTrigger>
                  <SelectContent>
                    {roomUnits.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Maintenance"
                />
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {reason === 'Other' && (
                <div className="space-y-2">
                  <Label>Specify Reason</Label>
                  <Input
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Enter reason"
                  />
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !startDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, 'MMM d, yyyy') : 'Pick date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => {
                          if (date) {
                            setStartDate(date);
                            if (endDate < date) setEndDate(date);
                          }
                        }}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !endDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, 'MMM d, yyyy') : 'Pick date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => date && setEndDate(date)}
                        disabled={(date) => date < startDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Recurring */}
              <div className="space-y-4 p-3 rounded-lg bg-secondary/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Recurring</p>
                    <p className="text-xs text-muted-foreground">
                      Repeat this block on a schedule
                    </p>
                  </div>
                  <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
                </div>

                {isRecurring && (
                  <div className="space-y-2">
                    <Label>Repeat</Label>
                    <Select value={recurrencePattern} onValueChange={(v) => setRecurrencePattern(v as unknown as 'weekly' | 'monthly' | 'yearly')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly (every {format(startDate, 'EEEE')})</SelectItem>
                        <SelectItem value="monthly">Monthly (on the {format(startDate, 'do')})</SelectItem>
                        <SelectItem value="yearly">Yearly (on {format(startDate, 'MMMM do')})</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* General Event Fields */}
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Event title"
                />
              </div>

              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Event description"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !startDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'MMM d, yyyy') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="all-day-event"
                  checked={allDay}
                  onCheckedChange={setAllDay}
                />
                <Label htmlFor="all-day-event">All day event</Label>
              </div>

              {!allDay && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {hasInvalidGeneralTimeRange && (
                <p className="text-sm text-destructive">
                  End time must be later than start time.
                </p>
              )}

              {!isCalendarConnected && (
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  Connect to Google to add general events
                </p>
              )}
            </>
          )}

          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !canSubmit}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {eventType === 'maintenance' ? 'Block Room' : 'Create Event'}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogBody>
    </ResponsiveDialog>
  );
}
