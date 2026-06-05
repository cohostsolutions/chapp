import { RefreshCw, Moon, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ReturningGuestBadgeProps {
  totalBookingsCount?: number | null;
  totalNightsStayed?: number | null;
  firstStayDate?: string | null;
  lastStayDate?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

export function ReturningGuestBadge({
  totalBookingsCount,
  totalNightsStayed,
  firstStayDate,
  lastStayDate,
  size = 'md',
  className,
}: ReturningGuestBadgeProps) {
  // Only show if guest has at least 1 completed booking
  if (!totalBookingsCount || totalBookingsCount < 1) {
    return null;
  }

  const isReturning = totalBookingsCount > 1;
  const nights = totalNightsStayed || 0;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return 'N/A';
    }
  };

  const badgeContent = (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-medium',
        isReturning
          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
          : 'bg-primary/10 text-primary border-primary/30',
        size === 'sm' ? 'text-xs py-0 px-1.5' : 'text-xs py-0.5 px-2',
        className
      )}
    >
      {isReturning ? (
        <>
          <RefreshCw className={cn('shrink-0', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
          <span className="whitespace-nowrap">
            {totalBookingsCount} stays • {nights} nights
          </span>
        </>
      ) : (
        <>
          <Moon className={cn('shrink-0', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
          <span className="whitespace-nowrap">
            {nights} night{nights !== 1 ? 's' : ''}
          </span>
        </>
      )}
    </Badge>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badgeContent}
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <div className="space-y-1">
          <div className="font-medium">
            {isReturning ? '🔁 Returning Guest' : '✨ First-time Guest'}
          </div>
          <div className="text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              <span>Total stays: {totalBookingsCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Moon className="h-3 w-3" />
              <span>Total nights: {nights}</span>
            </div>
            {firstStayDate && (
              <div>First stay: {formatDate(firstStayDate)}</div>
            )}
            {lastStayDate && (
              <div>Last stay: {formatDate(lastStayDate)}</div>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
