import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Settings, Trash2 } from 'lucide-react';

interface CalendarSource {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
}

interface CalendarManagerProps {
  calendars: CalendarSource[];
  isOpen: boolean;
  isRefetching: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleCalendar: (id: string) => void;
  onUpdateCalendarName: (id: string, name: string) => void;
  onRemoveCalendar: (id: string) => void;
}

export function CalendarManager({
  calendars,
  isOpen,
  isRefetching,
  onOpenChange,
  onToggleCalendar,
  onUpdateCalendarName,
  onRemoveCalendar,
}: CalendarManagerProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
                <p className="text-sm">No calendars found</p>
              </div>
            ) : (
              calendars.map((calendar) => (
                <div key={calendar.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                  <Checkbox
                    checked={calendar.enabled}
                    onCheckedChange={() => onToggleCalendar(calendar.id)}
                    disabled={isRefetching}
                  />
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: calendar.color }}
                  />
                  <Input
                    value={calendar.name}
                    onChange={(e) => onUpdateCalendarName(calendar.id, e.target.value)}
                    className="flex-1 h-8"
                    disabled={isRefetching}
                  />
                  {calendar.id !== 'primary' && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onRemoveCalendar(calendar.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove calendar</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        <div className="flex flex-col sm:flex-row gap-2 pt-4">
          <div className="text-sm text-muted-foreground flex-1">
            Calendars are synced from your Google Calendar account
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
