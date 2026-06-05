import { useCallback, useState } from 'react';
import { fetchWithRetryToast, FetchWithTimeoutOptions, TimeoutError, RetryError } from '@/lib/fetchWithTimeout';
import { toast } from 'sonner';

interface UseFetchWithRetryOptions extends Omit<FetchWithTimeoutOptions, 'onRetry'> {
  showToasts?: boolean;
}

interface UseFetchWithRetryReturn<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  execute: (url: string, options?: FetchWithTimeoutOptions) => Promise<T | null>;
  reset: () => void;
}

/**
 * Hook for making fetch requests with timeout and automatic retry
 */
export function useFetchWithRetry<T = unknown>(
  defaultOptions: UseFetchWithRetryOptions = {}
): UseFetchWithRetryReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { showToasts = true, ...fetchOptions } = defaultOptions;

  const execute = useCallback(
    async (url: string, options: FetchWithTimeoutOptions = {}): Promise<T | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchWithRetryToast(url, {
          ...fetchOptions,
          ...options,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        setData(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);

        if (showToasts) {
          if (error instanceof TimeoutError) {
            toast.error('Request timed out', {
              description: 'The server took too long to respond. Please try again.',
            });
          } else if (error instanceof RetryError) {
            toast.error('Request failed', {
              description: `Failed after ${error.attempts} attempts. Please check your connection.`,
            });
          }
        }

        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchOptions, showToasts]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { data, error, isLoading, execute, reset };
}

// Re-export types and utilities
export { TimeoutError, RetryError } from '@/lib/fetchWithTimeout';
export type { FetchWithTimeoutOptions } from '@/lib/fetchWithTimeout';
