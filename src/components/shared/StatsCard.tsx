import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, ArrowDownRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface StatsCardProps {
  label: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  iconColor?: string;
  isLoading?: boolean;
  animationDelay?: number;
  path?: string;
}

export function StatsCard({
  label,
  value,
  change,
  icon: Icon,
  iconColor = 'text-primary',
  isLoading = false,
  animationDelay = 0,
  path,
}: StatsCardProps) {
  const cardContent = (
    <CardContent className="p-4 lg:p-6">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs lg:text-sm text-muted-foreground truncate">
            {label}
          </p>
          <p className="text-xl lg:text-3xl font-bold mt-1 lg:mt-2 text-foreground">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {change !== undefined && (
            <div className={cn(
              "flex items-center gap-1 mt-1 lg:mt-2 text-xs lg:text-sm",
              change >= 0 ? 'text-success' : 'text-destructive'
            )}>
              {change >= 0 ? (
                <ArrowUpRight className="w-3 h-3 lg:w-4 lg:h-4" />
              ) : (
                <ArrowDownRight className="w-3 h-3 lg:w-4 lg:h-4" />
              )}
              <span className="hidden sm:inline">
                {change >= 0 ? '+' : ''}{change}% from last week
              </span>
              <span className="sm:hidden">
                {change >= 0 ? '+' : ''}{change}%
              </span>
            </div>
          )}
        </div>
        <div className={cn("p-2 lg:p-3 rounded-xl bg-secondary shrink-0", iconColor)}>
          <Icon className="w-4 h-4 lg:w-6 lg:h-6" />
        </div>
      </div>
    </CardContent>
  );

  if (isLoading) {
    return (
      <Card 
        className="glass animate-slide-up" 
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        <CardContent className="p-4 lg:p-6">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (path) {
    return (
      <Link to={path} className="block transition-transform transform hover:scale-105">
        <Card 
          className="glass animate-slide-up h-full" 
          style={{ animationDelay: `${animationDelay}ms` }}
        >
          {cardContent}
        </Card>
      </Link>
    );
  }

  return (
    <Card 
      className="glass animate-slide-up" 
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {cardContent}
    </Card>
  );
}
