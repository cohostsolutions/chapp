import { format, parseISO, isPast, isFuture, isToday } from 'date-fns';
import { Wrench, Trash2, Calendar, RefreshCw, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MaintenanceBlock } from '@/hooks/useMaintenanceBlocks';
import { cn } from '@/lib/utils';

interface MaintenanceBlocksListProps {
  blocks: MaintenanceBlock[];
  onDelete: (id: string) => Promise<boolean>;
  onEdit?: (block: MaintenanceBlock) => void;
  loading?: boolean;
}

export function MaintenanceBlocksList({
  blocks,
  onDelete,
  onEdit,
  loading,
}: MaintenanceBlocksListProps) {
  const getStatusBadge = (block: MaintenanceBlock) => {
    const start = parseISO(block.start_date);
    const end = parseISO(block.end_date);
    const now = new Date();

    if (isPast(end) && !isToday(end)) {
      return <Badge variant="secondary">Completed</Badge>;
    }
    if (isToday(start) || (now >= start && now <= end)) {
      return <Badge variant="destructive">Active</Badge>;
    }
    if (isFuture(start)) {
      return <Badge variant="outline">Scheduled</Badge>;
    }
    return null;
  };

  const getRecurrenceLabel = (block: MaintenanceBlock) => {
    if (!block.is_recurring || !block.recurrence_pattern) return null;

    switch (block.recurrence_pattern) {
      case 'weekly':
        return 'Weekly';
      case 'monthly':
        return 'Monthly';
      case 'yearly':
        return 'Yearly';
      default:
        return null;
    }
  };

  // Sort: active first, then upcoming, then past
  const sortedBlocks = [...blocks].sort((a, b) => {
    const aStart = parseISO(a.start_date);
    const bStart = parseISO(b.start_date);
    const aEnd = parseISO(a.end_date);
    const bEnd = parseISO(b.end_date);
    const now = new Date();

    // Active blocks first
    const aActive = now >= aStart && now <= aEnd;
    const bActive = now >= bStart && now <= bEnd;
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;

    // Then upcoming
    const aFuture = aStart > now;
    const bFuture = bStart > now;
    if (aFuture && !bFuture) return -1;
    if (!aFuture && bFuture) return 1;

    // Sort by start date
    return aStart.getTime() - bStart.getTime();
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (blocks.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <Wrench className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No maintenance blocks scheduled</p>
            <p className="text-xs text-muted-foreground mt-1">
              Block rooms for maintenance to prevent bookings during those times
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Wrench className="h-5 w-5 text-warning" />
          Maintenance Blocks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-3">
            {sortedBlocks.map((block) => (
              <div
                key={block.id}
                className={cn(
                  'p-3 rounded-lg border bg-card',
                  isPast(parseISO(block.end_date)) && !isToday(parseISO(block.end_date)) && 'opacity-60'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{block.title}</span>
                      {getStatusBadge(block)}
                      {block.is_recurring && (
                        <Badge variant="outline" className="gap-1">
                          <RefreshCw className="h-3 w-3" />
                          {getRecurrenceLabel(block)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {block.room_unit?.name || 'Unknown Room'}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3" />
                      {format(parseISO(block.start_date), 'MMM d')}
                      {block.start_date !== block.end_date && (
                        <> - {format(parseISO(block.end_date), 'MMM d, yyyy')}</>
                      )}
                      {block.start_date === block.end_date && (
                        <>, {format(parseISO(block.start_date), 'yyyy')}</>
                      )}
                    </div>
                    {block.reason && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Reason: {block.reason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEdit(block)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Maintenance Block?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the maintenance block for "{block.room_unit?.name}". 
                            The room will become available for bookings again.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(block.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
