import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MessageStatusProps {
  status?: string;
  className?: string;
}

export function MessageStatus({ status, className }: MessageStatusProps) {
  if (!status) return null;

  const normalizedStatus = status.toLowerCase();

  const getStatusIcon = () => {
    switch (normalizedStatus) {
      case 'sending':
      case 'pending':
        return <Clock className={cn("w-3 h-3 text-muted-foreground", className)} />;
      case 'sent':
        return <Check className={cn("w-3 h-3 text-muted-foreground", className)} />;
      case 'delivered':
        return <CheckCheck className={cn("w-3 h-3 text-muted-foreground", className)} />;
      case 'read':
        return <CheckCheck className={cn("w-3 h-3 text-primary", className)} />;
      case 'failed':
      case 'error':
        return <AlertCircle className={cn("w-3 h-3 text-destructive", className)} />;
      default:
        return <Check className={cn("w-3 h-3 text-muted-foreground", className)} />;
    }
  };

  const getStatusLabel = () => {
    switch (normalizedStatus) {
      case 'sending':
      case 'pending':
        return 'Sending...';
      case 'sent':
        return 'Sent';
      case 'delivered':
        return 'Delivered';
      case 'read':
        return 'Read';
      case 'failed':
      case 'error':
        return 'Failed to send';
      default:
        return status;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center">
            {getStatusIcon()}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {getStatusLabel()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
