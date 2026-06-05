import { useCallback, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { logError } from '@/lib/logger';

interface UseAsyncActionOptions {
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for handling async actions with loading state, error handling, and toast notifications
 */
export function useAsyncAction<TArgs extends unknown[], TResult>(
  asyncFn: (...args: TArgs) => Promise<TResult>,
  options: UseAsyncActionOptions = {}
) {
  const { toast } = useToast();
  const loadingRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      if (loadingRef.current) return null;
      
      loadingRef.current = true;
      setIsLoading(true);
      
      try {
        const result = await asyncFn(...args);
        
        if (options.successMessage) {
          toast({
            title: "Success",
            description: options.successMessage,
          });
        }
        
        options.onSuccess?.();
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        
        toast({
          title: "Error",
          description: options.errorMessage || errorMessage,
          variant: "destructive",
        });
        
        options.onError?.(error instanceof Error ? error : new Error(errorMessage));
        return null;
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
      }
    },
    [asyncFn, options, toast]
  );

  return {
    execute,
    isLoading,
  };
}

/**
 * Wrapper for try-catch with toast notifications
 */
export function withErrorHandling<T>(
  fn: () => Promise<T>,
  options: {
    toast: ReturnType<typeof useToast>['toast'];
    errorTitle?: string;
    errorDescription?: string;
    showError?: boolean;
  }
): Promise<T | null> {
  return fn().catch((error) => {
    if (options.showError !== false) {
      options.toast({
        title: options.errorTitle || "Error",
        description: options.errorDescription || (error instanceof Error ? error.message : 'Something went wrong'),
        variant: "destructive",
      });
    }
    logError(error instanceof Error ? error : new Error(String(error)));
    return null;
  });
}

/**
 * Creates a debounced error handler that prevents duplicate error toasts
 */
export function createDebouncedErrorHandler(toast: ReturnType<typeof useToast>['toast'], debounceMs = 3000) {
  let lastErrorTime = 0;
  let lastErrorMessage = '';
  
  return (error: Error | string, title = 'Error') => {
    const message = typeof error === 'string' ? error : error.message;
    const now = Date.now();
    
    // Prevent duplicate error toasts within debounce period
    if (message === lastErrorMessage && now - lastErrorTime < debounceMs) {
      return;
    }
    
    lastErrorTime = now;
    lastErrorMessage = message;
    
    toast({
      title,
      description: message,
      variant: "destructive",
    });
  };
}

/**
 * Formats error messages for user display
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Handle common error types
    if (error.message.includes('Failed to fetch')) {
      return 'Unable to connect. Please check your internet connection.';
    }
    if (error.message.includes('NetworkError')) {
      return 'Network error. Please try again.';
    }
    if (error.message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      return 'Your session has expired. Please log in again.';
    }
    if (error.message.includes('403') || error.message.includes('Forbidden')) {
      return 'You don\'t have permission to perform this action.';
    }
    if (error.message.includes('404') || error.message.includes('Not Found')) {
      return 'The requested resource was not found.';
    }
    if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
      return 'Server error. Please try again later.';
    }
    if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Determines error type for appropriate UI display
 */
export function getErrorType(error: unknown): 'network' | 'auth' | 'server' | 'timeout' | 'generic' {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return 'network';
  }
  if (message.includes('401') || message.includes('unauthorized') || message.includes('403') || message.includes('forbidden')) {
    return 'auth';
  }
  if (message.includes('500') || message.includes('server')) {
    return 'server';
  }
  if (message.includes('timeout')) {
    return 'timeout';
  }
  
  return 'generic';
}
