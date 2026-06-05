import { format, parseISO } from 'date-fns';
import { ChevronLeft, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CalendarEvent } from '@/hooks/useGoogleCalendar';

interface EventDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
}

export function EventDetailDialog({
  open,
  onOpenChange,
  event,
}: EventDetailDialogProps) {
  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-2">
            <ChevronLeft 
              className="h-4 w-4 cursor-pointer hover:text-primary transition-colors" 
              onClick={() => onOpenChange(false)}
            />
            <DialogTitle className="text-base">Event Details</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div 
            className="p-4 rounded-lg border" 
            style={{ borderLeftColor: 'hsl(var(--primary))', borderLeftWidth: 4 }}
          >
            <h3 className="font-semibold text-lg">{event.title}</h3>
            
            {event.allDay ? (
              <Badge variant="secondary" className="mt-2">All Day</Badge>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                {format(parseISO(event.startTime), 'h:mm a')} - {format(parseISO(event.endTime), 'h:mm a')}
              </p>
            )}
            
            {event.calendarName && (
              <p className="text-sm text-muted-foreground mt-2">
                Calendar: {event.calendarName}
              </p>
            )}
            
            {event.description && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {event.description}
                </p>
              </div>
            )}
            
            {event.attendees && event.attendees.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-1">Attendees</p>
                <div className="flex flex-wrap gap-1">
                  {event.attendees.map((attendee, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {attendee}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
