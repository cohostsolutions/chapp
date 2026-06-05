import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Settings, RefreshCw, HelpCircle, Clock, Sun, Moon, Sunrise, Sunset } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface DashboardHeaderProps {
  userName?: string;
  subtitle?: string;
  onCustomize?: () => void;
  onRefresh?: () => void;
  isEditMode?: boolean;
  isRefreshing?: boolean;
  lastRefreshed?: Date | null;
  showHelp?: boolean;
  onHelp?: () => void;
}

const getTimeOfDayGreeting = (): { greeting: string; icon: React.ReactNode } => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return { greeting: 'Good morning', icon: <Sunrise className="w-5 h-5 text-warning" /> };
  } else if (hour >= 12 && hour < 17) {
    return { greeting: 'Good afternoon', icon: <Sun className="w-5 h-5 text-warning" /> };
  } else if (hour >= 17 && hour < 21) {
    return { greeting: 'Good evening', icon: <Sunset className="w-5 h-5 text-orange-500" /> };
  } else {
    return { greeting: 'Good night', icon: <Moon className="w-5 h-5 text-primary" /> };
  }
};

export function DashboardHeader({
  userName,
  subtitle,
  onCustomize,
  onRefresh,
  isEditMode = false,
  isRefreshing = false,
  lastRefreshed,
  showHelp = false,
  onHelp,
}: DashboardHeaderProps) {
  const { greeting, icon } = getTimeOfDayGreeting();
  const firstName = userName?.split(' ')[0] || 'User';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="hidden sm:block">{icon}</span>
          <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-foreground truncate">
            {greeting}, {firstName}
          </h1>
        </div>
        <div className="flex items-center gap-2 mt-0.5 md:mt-1">
          <p className="text-xs md:text-sm lg:text-base text-muted-foreground">
            {subtitle || format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
          {lastRefreshed && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-[10px] h-5 gap-1 hidden sm:flex">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(lastRefreshed, { addSuffix: true })}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Last refreshed: {format(lastRefreshed, 'HH:mm:ss')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        {onRefresh && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="h-7 md:h-8 w-7 md:w-8 p-0"
                >
                  <RefreshCw className={cn(
                    "w-3.5 h-3.5 md:w-4 md:h-4",
                    isRefreshing && "animate-spin"
                  )} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh data</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        {showHelp && onHelp && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onHelp}
                  className="h-7 md:h-8 w-7 md:w-8 p-0"
                >
                  <HelpCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Dashboard help</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        {onCustomize && (
          <Button 
            variant={isEditMode ? "default" : "outline"}
            size="sm" 
            onClick={onCustomize}
            className="gap-1.5 h-7 md:h-8 text-xs md:text-sm"
          >
            <Settings className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden sm:inline">{isEditMode ? 'Done' : 'Customize'}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
