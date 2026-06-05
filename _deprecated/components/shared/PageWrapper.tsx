import React, { Suspense } from 'react';
import { SectionErrorBoundary } from '@/components/ErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PageWrapperProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
}

/**
 * Consistent page wrapper with accessibility, error handling, and loading states
 */
export function PageWrapper({ children, title, description, className }: PageWrapperProps) {
  return (
    <main
      id="main-content"
      role="main"
      aria-label={title}
      className={cn("space-y-4 lg:space-y-6 animate-fade-in", className)}
      tabIndex={-1}
    >
      {children}
    </main>
  );
}

interface PageSectionProps {
  children: React.ReactNode;
  name: string;
  className?: string;
  fallback?: React.ReactNode;
}

/**
 * Section wrapper with error boundary and optional loading state
 */
export function PageSection({ children, name, className, fallback }: PageSectionProps) {
  return (
    <SectionErrorBoundary name={name} className={className}>
      <Suspense fallback={fallback || <SectionSkeleton />}>
        {children}
      </Suspense>
    </SectionErrorBoundary>
  );
}

function SectionSkeleton() {
  return (
    <Card className="glass">
      <CardContent className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Consistent page header with proper heading hierarchy
 */
export function PageHeader({ title, description, icon, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4", className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="p-2 rounded-lg bg-primary/10" aria-hidden="true">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground">{title}</h1>
          {description && (
            <p className="text-sm lg:text-base text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2" role="group" aria-label="Page actions">
          {actions}
        </div>
      )}
    </header>
  );
}
