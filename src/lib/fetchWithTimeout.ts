import { toast } from 'sonner';

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

class TimeoutError extends Error {
  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
  }
}

class RetryError extends Error {
  public attempts: number;
  public lastError: Error;

  constructor(attempts: number, lastError: Error) {
    super(`Request failed after ${attempts} attempts: ${lastError.message}`);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

/**
 * Fetch with timeout and automatic retry support
 */
export async function fetchWithTimeout(
  url: string | URL,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeout = 30000, // 30 second default timeout
    retries = 2,
    retryDelay = 1000,
    onRetry,
    ...fetchOptions
  } = options;

  let lastError: Error = new Error('Unknown error');
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Only retry on server errors (5xx) or network issues
      if (!response.ok && response.status >= 500 && attempt < retries) {
        throw new Error(`Server error: ${response.status}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        // Convert abort to timeout error
        if (error.name === 'AbortError') {
          lastError = new TimeoutError(timeout);
        } else {
          lastError = error;
        }
      }

      // Don't retry if we're out of attempts or it's not a retryable error
      const isRetryable = 
        lastError instanceof TimeoutError ||
        lastError.message.includes('Server error') ||
        lastError.message.includes('Failed to fetch') ||
        lastError.message.includes('NetworkError');

      if (attempt < retries && isRetryable) {
        onRetry?.(attempt + 1, lastError);
        
        // Wait before retrying with exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, retryDelay * Math.pow(2, attempt))
        );
        continue;
      }

      throw lastError;
    }
  }

  throw new RetryError(retries + 1, lastError);
}

/**
 * Hook-friendly wrapper that shows toast notifications for timeouts/retries
 */
export async function fetchWithRetryToast(
  url: string | URL,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  let toastId: string | number | undefined;

  try {
    return await fetchWithTimeout(url, {
      ...options,
      onRetry: (attempt, error) => {
        options.onRetry?.(attempt, error);
        
        if (attempt === 1) {
          toastId = toast.loading('Connection slow, retrying...', {
            description: error.message,
          });
        } else {
          toast.loading(`Retry attempt ${attempt}...`, {
            id: toastId,
            description: error.message,
          });
        }
      },
    });
  } catch (error) {
    if (toastId) {
      toast.dismiss(toastId);
    }
    throw error;
  } finally {
    if (toastId) {
      toast.dismiss(toastId);
    }
  }
}

/**
 * Create a configured fetch function with default timeout/retry settings
 */
export function createFetchClient(defaultOptions: FetchWithTimeoutOptions = {}) {
  return (url: string | URL, options: FetchWithTimeoutOptions = {}) =>
    fetchWithTimeout(url, { ...defaultOptions, ...options });
}

// Export error classes for type checking
export { TimeoutError, RetryError };
