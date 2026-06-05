import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CalendarEvent } from '@/hooks/useGoogleCalendar';
import { Download, Copy, CheckCircle2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { generateICS, downloadICS, copyICSToClipboard, generateICSForDateRange } from '@/lib/ics-generator';
import { useToast } from '@/hooks/use-toast';

interface ExportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  events: CalendarEvent[];
  selectedDate: Date;
}

export function ExportDialog({ isOpen, onOpenChange, events, selectedDate }: ExportDialogProps) {
  const { toast } = useToast();
  const [exportType, setExportType] = useState<'all' | 'today' | 'range'>('all');
  const [calendarName, setCalendarName] = useState('My Calendar');
  const [startDate, setStartDate] = useState(format(selectedDate, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(selectedDate, 7), 'yyyy-MM-dd'));
  const [isCopied, setIsCopied] = useState(false);

  const getEventsToExport = (): CalendarEvent[] => {
    switch (exportType) {
      case 'today': {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        return events.filter(e => e.startTime.startsWith(dateStr));
      }
      case 'range': {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        return events.filter(e => {
          const eventDate = new Date(e.startTime);
          return eventDate >= start && eventDate <= end;
        });
      }
      case 'all':
      default:
        return events;
    }
  };

  const handleDownload = () => {
    const eventsToExport = getEventsToExport();
    if (eventsToExport.length === 0) {
      toast({
        title: 'No events',
        description: 'There are no events to export for the selected range.',
        variant: 'destructive',
      });
      return;
    }

    const icsContent = generateICS(eventsToExport, calendarName);
    const filename = `${calendarName.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.ics`;
    downloadICS(icsContent, filename);

    toast({
      title: 'Export successful',
      description: `Downloaded ${eventsToExport.length} event${eventsToExport.length !== 1 ? 's' : ''}`,
    });
  };

  const handleCopy = async () => {
    const eventsToExport = getEventsToExport();
    if (eventsToExport.length === 0) {
      toast({
        title: 'No events',
        description: 'There are no events to export for the selected range.',
        variant: 'destructive',
      });
      return;
    }

    const icsContent = generateICS(eventsToExport, calendarName);
    const success = await copyICSToClipboard(icsContent);

    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      toast({
        title: 'Copied to clipboard',
        description: `${eventsToExport.length} event${eventsToExport.length !== 1 ? 's' : ''} ready to paste`,
      });
    } else {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const eventsToExport = getEventsToExport();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Events to ICS</DialogTitle>
          <DialogDescription>
            Export your events in iCalendar format
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Calendar Name */}
          <div>
            <Label htmlFor="calendar-name" className="text-sm font-medium">
              Calendar Name
            </Label>
            <Input
              id="calendar-name"
              value={calendarName}
              onChange={(e) => setCalendarName(e.target.value)}
              placeholder="My Calendar"
              className="mt-1"
            />
          </div>

          {/* Export Type Selection */}
          <Tabs value={exportType} onValueChange={(v) => setExportType(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="range">Range</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {events.filter(e => e.startTime.startsWith(format(selectedDate, 'yyyy-MM-dd'))).length} event{events.filter(e => e.startTime.startsWith(format(selectedDate, 'yyyy-MM-dd'))).length !== 1 ? 's' : ''} on {format(selectedDate, 'MMM d, yyyy')}
              </p>
            </TabsContent>

            <TabsContent value="range" className="space-y-3">
              <div>
                <Label htmlFor="start-date" className="text-sm">
                  Start Date
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="end-date" className="text-sm">
                  End Date
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </TabsContent>

            <TabsContent value="all">
              <p className="text-sm text-muted-foreground">
                All {events.length} event{events.length !== 1 ? 's' : ''} will be exported
              </p>
            </TabsContent>
          </Tabs>

          {/* Export Summary */}
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-sm font-medium text-blue-900">
              {eventsToExport.length} event{eventsToExport.length !== 1 ? 's' : ''} ready to export
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleDownload}
              disabled={eventsToExport.length === 0}
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              onClick={handleCopy}
              disabled={eventsToExport.length === 0}
              variant="outline"
              className="flex-1"
            >
              {isCopied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
