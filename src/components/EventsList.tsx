import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Clock, MapPin, Users, Edit, Trash2, Repeat } from 'lucide-react';
import type { CalendarEvent } from '@/hooks/useGoogleCalendar';

interface CalendarSource {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
}

interface EventsListProps {
  events: CalendarEvent[];
  selectedDate: Date;
  calendars: CalendarSource[];
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (event: CalendarEvent) => void;
  formatEventTime: (event: CalendarEvent) => string;
  getDateLabel: (date: Date) => string;
}

const FALLBACK_COLORS = [
  'hsl(var(--primary))',
  'hsl(142 76% 36%)',
  'hsl(38 92% 50%)',
  'hsl(280 65% 60%)',
  'hsl(199 89% 48%)',
];

export function EventsList({
  events,
  selectedDate,
  calendars,
  onEditEvent,
  onDeleteEvent,
  formatEventTime,
  getDateLabel,
}: EventsListProps) {
  const getCalendarColor = (calendarId: string): string => {
    const calendar = calendars.find(c => c.id === calendarId);
    return calendar?.color || FALLBACK_COLORS[0];
  };

  return (
    <Card>
      <CardHeader className="pb-3 px-3 sm:px-6">
        <CardTitle className="text-base sm:text-lg">
          Events for {getDateLabel(selectedDate)}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {events.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">No events scheduled</p>
            <p className="text-xs mt-1">Create one to get started</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2 px-3 sm:px-6 py-2">
              {events.map(event => {
                const eventColor = getCalendarColor(event.calendarId || 'primary');

                return (
                  <TooltipProvider key={event.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'p-2 sm:p-3 rounded-lg border border-border bg-card hover:bg-accent/50 active:bg-accent transition-colors touch-manipulation cursor-pointer',
                            event.allDay && 'bg-primary/5 border-primary/20'
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
                                  onEditEvent(event);
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
                                  onDeleteEvent(event);
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
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
