import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
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
import { cn } from '@/lib/utils';
import { CreateMaintenanceBlockInput } from '@/hooks/useMaintenanceBlocks';

interface RoomUnit {
  id: string;
  name: string;
}

interface AddMaintenanceBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateMaintenanceBlockInput) => Promise<any>;
  roomUnits: RoomUnit[];
  saving: boolean;
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

export function AddMaintenanceBlockDialog({
  open,
  onOpenChange,
  onSubmit,
  roomUnits,
  saving,
}: AddMaintenanceBlockDialogProps) {
  const [roomUnitId, setRoomUnitId] = useState('');
  const [title, setTitle] = useState('Maintenance');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');

  useEffect(() => {
    if (open) {
      setRoomUnitId('');
      setTitle('Maintenance');
      setReason('');
      setCustomReason('');
      setStartDate(new Date());
      setEndDate(new Date());
      setIsRecurring(false);
      setRecurrencePattern('weekly');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalReason = reason === 'Other' ? customReason : reason;

    const result = await onSubmit({
      room_unit_id: roomUnitId,
      title,
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
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} showCloseButton={false}>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-warning" />
          Schedule Maintenance
        </ResponsiveDialogTitle>
      </ResponsiveDialogHeader>

      <ResponsiveDialogBody>
        <form onSubmit={handleSubmit} className="space-y-4">
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
                  <Calendar
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
                  <Calendar
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
                <p className="text-sm font-medium">Recurring Maintenance</p>
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

          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !roomUnitId}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Block Room
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogBody>
    </ResponsiveDialog>
  );
}
