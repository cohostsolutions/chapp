import { useState } from 'react';
import { Calendar, X } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface ConversationDateFilterProps {
  dateRange: DateRange;
  onChange: (range: DateRange) => void;
}

const presets = [
  { label: 'Today', getValue: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: 'Last 7 days', getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: 'Last 30 days', getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: 'Last 90 days', getValue: () => ({ from: subDays(new Date(), 90), to: new Date() }) },
];

export function ConversationDateFilter({ dateRange, onChange }: ConversationDateFilterProps) {
  const [open, setOpen] = useState(false);

  const hasSelection = dateRange.from || dateRange.to;

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ from: undefined, to: undefined });
  };

  const formatDateRange = () => {
    if (dateRange.from && dateRange.to) {
      if (format(dateRange.from, 'yyyy-MM-dd') === format(dateRange.to, 'yyyy-MM-dd')) {
        return format(dateRange.from, 'MMM d, yyyy');
      }
      return `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`;
    }
    if (dateRange.from) {
      return `From ${format(dateRange.from, 'MMM d, yyyy')}`;
    }
    if (dateRange.to) {
      return `Until ${format(dateRange.to, 'MMM d, yyyy')}`;
    }
    return 'Select dates';
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-9 gap-1.5 text-xs ${hasSelection ? 'border-primary' : ''}`}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{formatDateRange()}</span>
          <span className="sm:hidden">
            {hasSelection ? <Badge variant="secondary" className="h-4 px-1 text-[10px]">1</Badge> : 'Date'}
          </span>
          {hasSelection && (
            <X
              className="h-3 w-3 ml-1 hover:text-destructive"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <div className="p-3 border-b sm:border-b-0 sm:border-r">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">Quick Select</p>
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-8"
                  onClick={() => {
                    onChange(preset.getValue());
                    setOpen(false);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
              {hasSelection && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-8 text-destructive hover:text-destructive"
                  onClick={() => {
                    onChange({ from: undefined, to: undefined });
                    setOpen(false);
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
          <div className="p-3">
            <CalendarComponent
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => {
                onChange({ from: range?.from, to: range?.to });
              }}
              numberOfMonths={1}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
