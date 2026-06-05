import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatErrorMessage, getErrorType } from './useErrorHandling';
import { logError } from '@/lib/logger';

interface QueryErrorHandlerOptions {
  showToast?: boolean;
  retryOnError?: boolean;
  maxRetries?: number;
}

/**
 * Global query error handler for React Query
 * Provides consistent error handling across all queries
 */
export function useQueryErrorHandler(options: QueryErrorHandlerOptions = {}) {
  const { showToast = true, retryOnError = true, maxRetries = 3 } = options;
  const queryClient = useQueryClient();

  const handleError = useCallback((error: unknown, queryKey?: unknown[]) => {
    const message = formatErrorMessage(error);
    const errorType = getErrorType(error);
    
    logError(error instanceof Error ? error : new Error(String(error)), { queryKey, errorType });

    if (showToast) {
      const toastConfig: Record<string, { title: string; action?: () => void }> = {
        network: { 
          title: 'Connection issue',
          action: () => queryKey && queryClient.invalidateQueries({ queryKey })
        },
        auth: { title: 'Session expired' },
        server: { title: 'Server error' },
        timeout: { 
          title: 'Request timeout',
          action: () => queryKey && queryClient.invalidateQueries({ queryKey })
        },
        generic: { title: 'Something went wrong' },
      };

      const config = toastConfig[errorType];
      
      toast.error(config.title, {
        description: message,
        action: config.action ? {
          label: 'Retry',
          onClick: config.action,
        } : undefined,
      });
    }

    return { message, errorType };
  }, [showToast, queryClient]);

  return { 
    handleError,
    defaultRetry: (failureCount: number, error: unknown) => {
      if (!retryOnError) return false;
      if (failureCount >= maxRetries) return false;
      
      const errorType = getErrorType(error);
      // Don't retry auth errors
      if (errorType === 'auth') return false;
      // Retry network and timeout errors
      if (errorType === 'network' || errorType === 'timeout') return true;
      // Retry server errors with backoff
      if (errorType === 'server' && failureCount < 2) return true;
      
      return false;
    },
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  };
}

/**
 * Hook for handling mutation errors with toast notifications
 */
export function useMutationErrorHandler() {
  const handleError = useCallback((error: unknown, context?: string) => {
    const message = formatErrorMessage(error);
    const errorType = getErrorType(error);
    
    logError(error instanceof Error ? error : new Error(String(error)), { context, errorType });

    toast.error(context || 'Action failed', {
      description: message,
    });

    return { message, errorType };
  }, []);

  return { handleError };
}

/**
 * Creates a wrapped query function with automatic error handling
 */
export function createSafeQueryFn<T>(
  queryFn: () => Promise<T>,
  options?: { fallback?: T; logError?: boolean }
): () => Promise<T> {
  return async () => {
    try {
      return await queryFn();
    } catch (error) {
      if (options?.logError !== false) {
        logError(error instanceof Error ? error : new Error(String(error)), { context: 'queryFunction' });
      }
      if (options?.fallback !== undefined) {
        return options.fallback;
      }
      throw error;
    }
  };
}
