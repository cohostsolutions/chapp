import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Clock, Repeat } from 'lucide-react';
import type { CalendarEvent } from '@/hooks/useGoogleCalendar';

interface CalendarSource {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
}

interface CalendarGridProps {
  currentMonth: Date;
  onCurrentMonthChange: (date: Date) => void;
  selectedDate: Date;
  onSelectedDateChange: (date: Date) => void;
  eventsByDate: Map<string, CalendarEvent[]>;
  calendars: CalendarSource[];
  isRefetching: boolean;
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
  calendarFilter: string;
  formatEventTime: (event: CalendarEvent) => string;
  onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: (e: React.TouchEvent<HTMLDivElement>) => void;
}

const FALLBACK_COLORS = [
  'hsl(var(--primary))',
  'hsl(142 76% 36%)',
  'hsl(38 92% 50%)',
  'hsl(280 65% 60%)',
  'hsl(199 89% 48%)',
];

export function CalendarGrid({
  currentMonth,
  onCurrentMonthChange,
  selectedDate,
  onSelectedDateChange,
  eventsByDate,
  calendars,
  isRefetching,
  onEventClick,
  onDayClick,
  calendarFilter,
  formatEventTime,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: CalendarGridProps) {
  // Calendar grid calculation
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = monthStart.getDay();
  const paddedDays = Array(startDay).fill(null).concat(daysInMonth);

  const getEventsForDate = useCallback((date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return eventsByDate.get(dateKey) || [];
  }, [eventsByDate]);

  const getCalendarColor = (calendarId: string): string => {
    const calendar = calendars.find(c => c.id === calendarId);
    return calendar?.color || FALLBACK_COLORS[0];
  };

  return (
    <Card
      className="lg:col-span-2 relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {isRefetching && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
          <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-lg border shadow-lg">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 sm:h-9 sm:w-9"
                    onClick={() => onCurrentMonthChange(subMonths(currentMonth, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Previous month</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="outline"
              size="sm"
              className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
              onClick={() => {
                onCurrentMonthChange(new Date());
                onSelectedDateChange(new Date());
              }}
            >
              Today
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 sm:h-9 sm:w-9"
                    onClick={() => onCurrentMonthChange(addMonths(currentMonth, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Next month</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-6">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs sm:text-sm font-semibold text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days grid with intersection observer for lazy loading */}
        <div className="grid grid-cols-7 gap-1">
          {paddedDays.map((day, index) => {
            const dayEvents = day ? getEventsForDate(day) : [];
            const isCurrentMonth = day && isSameMonth(day, currentMonth);
            const isSelected = day && isSameDay(day, selectedDate);

            return (
              <div
                key={index}
                className={cn(
                  'min-h-[60px] sm:min-h-[80px] p-1 sm:p-2 border rounded-lg transition-colors',
                  isSelected && 'bg-primary/10 border-primary',
                  !isCurrentMonth && 'bg-muted/50 opacity-50',
                  isCurrentMonth && !isSelected && 'bg-card hover:bg-accent cursor-pointer'
                )}
                onClick={() => day && onDayClick(day)}
              >
                {day && (
                  <>
                    <div className="text-xs sm:text-sm font-semibold mb-1">{format(day, 'd')}</div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 2).map(event => {
                        const eventColor = getCalendarColor(event.calendarId || 'primary');
                        return (
                          <div
                            key={event.id}
                            className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                            style={{ backgroundColor: eventColor, color: 'white' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick(event);
                            }}
                            title={event.title}
                          >
                            {event.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-muted-foreground px-1">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
