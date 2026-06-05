import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
import { cn } from '@/lib/utils';

export type PeriodType = 'this-month' | 'last-month' | 'last-3-months' | 'all-time' | 'custom';

interface PeriodFilterProps {
  period: PeriodType;
  onPeriodChange: (period: PeriodType) => void;
  customStartDate?: Date;
  customEndDate?: Date;
  onCustomDateChange?: (start: Date | undefined, end: Date | undefined) => void;
}

export function PeriodFilter({
  period,
  onPeriodChange,
  customStartDate,
  customEndDate,
  onCustomDateChange,
}: PeriodFilterProps) {
  const normalizedCustomRange =
    customStartDate && customEndDate && customStartDate > customEndDate
      ? { start: customEndDate, end: customStartDate }
      : { start: customStartDate, end: customEndDate };

  const getDateRange = (periodType: PeriodType) => {
    const now = new Date();
    switch (periodType) {
      case 'this-month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last-month':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'last-3-months':
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      case 'all-time':
        return { start: undefined, end: undefined };
      case 'custom':
        return { start: normalizedCustomRange.start, end: normalizedCustomRange.end };
    }
  };

  const dateRange = getDateRange(period);
  const displayText = period === 'custom' && normalizedCustomRange.start && normalizedCustomRange.end
    ? `${format(normalizedCustomRange.start, 'MMM d')} - ${format(normalizedCustomRange.end, 'MMM d, yyyy')}`
    : period === 'this-month'
    ? format(new Date(), 'MMMM yyyy')
    : period === 'last-month'
    ? format(subMonths(new Date(), 1), 'MMMM yyyy')
    : period === 'last-3-months'
    ? 'Last 3 months'
    : 'All time';

  return (
    <div className="flex items-center gap-2">
      <Select value={period} onValueChange={(v) => onPeriodChange(v as PeriodType)}>
        <SelectTrigger className="w-[180px]">
          <CalendarIcon className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="this-month">This Month</SelectItem>
          <SelectItem value="last-month">Last Month</SelectItem>
          <SelectItem value="last-3-months">Last 3 Months</SelectItem>
          <SelectItem value="all-time">All Time</SelectItem>
          <SelectItem value="custom">Custom Range</SelectItem>
        </SelectContent>
      </Select>

      {period === 'custom' && onCustomDateChange && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'justify-start text-left font-normal',
                  !customStartDate && 'text-muted-foreground'
                )}
              >
                {customStartDate ? format(customStartDate, 'MMM d, yyyy') : 'Start date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={normalizedCustomRange.start}
                onSelect={(date) => onCustomDateChange(date, normalizedCustomRange.end)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">to</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'justify-start text-left font-normal',
                  !normalizedCustomRange.end && 'text-muted-foreground'
                )}
              >
                {normalizedCustomRange.end ? format(normalizedCustomRange.end, 'MMM d, yyyy') : 'End date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={normalizedCustomRange.end}
                onSelect={(date) => onCustomDateChange(normalizedCustomRange.start, date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}

export function getDateRangeFromPeriod(
  period: PeriodType,
  customStartDate?: Date,
  customEndDate?: Date
) {
  const normalizedCustomRange =
    customStartDate && customEndDate && customStartDate > customEndDate
      ? { start: customEndDate, end: customStartDate }
      : { start: customStartDate, end: customEndDate };

  const now = new Date();
  switch (period) {
    case 'this-month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'last-month':
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    case 'last-3-months':
      return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    case 'all-time':
      return { start: undefined, end: undefined };
    case 'custom':
      return { start: normalizedCustomRange.start, end: normalizedCustomRange.end };
  }
}
