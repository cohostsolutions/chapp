import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function NetworkStatusIndicator({ className }: { className?: string }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowAnimation(true);
      setTimeout(() => setShowAnimation(false), 2000);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setShowAnimation(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Only show indicator when offline or recently came online
  if (isOnline && !showAnimation) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all duration-300',
            isOnline
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-destructive/10 text-destructive animate-pulse',
            showAnimation && 'scale-105',
            className
          )}
        >
          {isOnline ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">
            {isOnline ? 'Back online' : 'Offline'}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {isOnline 
          ? 'Your connection has been restored' 
          : 'You are currently offline. Some features may be unavailable.'}
      </TooltipContent>
    </Tooltip>
  );
}
