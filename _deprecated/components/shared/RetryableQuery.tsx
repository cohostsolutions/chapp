import React from 'react';
import { UseQueryResult } from '@tanstack/react-query';
import { ErrorState } from './ErrorStates';
import { getErrorType } from '@/hooks/useErrorHandling';
import { Skeleton } from '@/components/ui/skeleton';

interface RetryableQueryProps<T> {
  query: UseQueryResult<T, Error>;
  children: (data: T) => React.ReactNode;
  loadingFallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  showRetry?: boolean;
  className?: string;
}

/**
 * Wrapper component for React Query results with built-in loading and error states
 */
export function RetryableQuery<T>({
  query,
  children,
  loadingFallback,
  errorFallback,
  showRetry = true,
  className,
}: RetryableQueryProps<T>) {
  const { data, isLoading, isError, error, refetch, isFetching } = query;

  if (isLoading) {
    return (
      <div className={className}>
        {loadingFallback || (
          <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
      </div>
    );
  }

  if (isError) {
    if (errorFallback) {
      return <div className={className}>{errorFallback}</div>;
    }

    const errorType = getErrorType(error);
    
    return (
      <div className={className}>
        <ErrorState
          type={errorType}
          onRetry={showRetry ? () => refetch() : undefined}
          isRetrying={isFetching}
        />
      </div>
    );
  }

  if (data === undefined || data === null) {
    return null;
  }

  return <>{children(data)}</>;
}

/**
 * Simple loading wrapper for async content
 */
interface AsyncContentProps {
  isLoading: boolean;
  isError?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  children: React.ReactNode;
  loadingFallback?: React.ReactNode;
  className?: string;
}

export function AsyncContent({
  isLoading,
  isError,
  error,
  onRetry,
  children,
  loadingFallback,
  className,
}: AsyncContentProps) {
  if (isLoading) {
    return (
      <div className={className}>
        {loadingFallback || (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}
      </div>
    );
  }

  if (isError && error) {
    const errorType = getErrorType(error);
    return (
      <div className={className}>
        <ErrorState
          type={errorType}
          onRetry={onRetry}
        />
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Inline loading state for small sections
 */
interface InlineLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function InlineLoading({ isLoading, children, size = 'md' }: InlineLoadingProps) {
  if (isLoading) {
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    };
    
    return (
      <span className="inline-flex items-center gap-2">
        <span className={`animate-spin rounded-full border-2 border-primary border-t-transparent ${sizeClasses[size]}`} />
      </span>
    );
  }

  return <>{children}</>;
}
