/**
 * Request Debouncer - Prevents duplicate API requests from rapid button clicks
 * SECURITY: Critical for preventing DoS attacks via duplicate submissions
 * Uses operation key to deduplicate identical requests within time window
 */

interface PendingRequest {
  promise: Promise<unknown>;
  timer: NodeJS.Timeout;
  timestamp: number;
}

/**
 * Global request debouncer instance
 * Prevents duplicate API calls when users rapidly click buttons
 * Example: 50 clicks in 1 second = 1 API call (not 50)
 */
export class RequestDebouncer {
  private pending = new Map<string, PendingRequest>();
  private readonly defaultDelay = 500; // 500ms debounce window

  /**
   * Debounce an async operation
   * Returns existing pending request if called within delay window
   * @param key - Unique operation identifier (e.g., "save-lead")
   * @param fn - Async function to execute
   * @param delay - Debounce delay in milliseconds (default 500ms)
   * @returns Promise that resolves when operation completes
   */
  async debounce<T>(
    key: string,
    fn: () => Promise<T>,
    delay: number = this.defaultDelay
  ): Promise<T> {
    // If operation already pending, return existing promise
    const pending = this.pending.get(key);
    if (pending) {
      return pending.promise as Promise<T>;
    }

    // Create new debounced operation
    let resolveDebounce: (value: T) => void;
    let rejectDebounce: (reason?: unknown) => void;

    const promise = new Promise<T>((resolve, reject) => {
      resolveDebounce = resolve;
      rejectDebounce = reject;
    });

    const timer = setTimeout(async () => {
      try {
        // Execute the actual function
        const result = await fn();
        // Clean up after success
        this.pending.delete(key);
        resolveDebounce(result);
      } catch (error) {
        // Clean up after error
        this.pending.delete(key);
        rejectDebounce(error);
      }
    }, delay);

    // Store pending request with timer
    const request: PendingRequest = {
      promise,
      timer,
      timestamp: Date.now(),
    };

    this.pending.set(key, request);
    return promise;
  }

  /**
   * Cancel pending operation and clear timer
   * @param key - Operation identifier
   */
  cancel(key: string): void {
    const pending = this.pending.get(key);
    if (pending) {
      clearTimeout(pending.timer);
      this.pending.delete(key);
    }
  }

  /**
   * Cancel all pending operations
   * Useful for cleanup (e.g., before page navigation)
   */
  cancelAll(): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
    }
    this.pending.clear();
  }

  /**
   * Check if operation is currently pending
   * @param key - Operation identifier
   * @returns true if operation is pending
   */
  isPending(key: string): boolean {
    return this.pending.has(key);
  }

  /**
   * Get number of pending operations
   */
  getPendingCount(): number {
    return this.pending.size;
  }
}

// Export singleton instance
export const debouncer = new RequestDebouncer();

/**
 * Custom hook for debounced async operations
 * Usage:
 * ```tsx
 * const { execute, isLoading } = useDebouncedAsync(saveFunction, 'save-key');
 * <Button onClick={execute} disabled={isLoading}>Save</Button>
 * ```
 */
export function createDebouncedFunction<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  operationKey: string,
  delay: number = 500
) {
  return async (...args: T): Promise<R> => {
    return debouncer.debounce(operationKey, () => fn(...args), delay);
  };
}

/**
 * Rate limiter for preventing too many requests in a time window
 * Example: Max 10 requests per second per user
 */
export class RateLimiter {
  private timestamps = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(maxRequests: number = 10, windowMs: number = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if request should be allowed
   * @param key - Request identifier (e.g., user ID + operation)
   * @returns true if allowed, false if rate limited
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const timestamps = this.timestamps.get(key) || [];

    // Remove old timestamps outside window
    const filtered = timestamps.filter((t) => now - t < this.windowMs);

    // Check if within limit
    if (filtered.length < this.maxRequests) {
      filtered.push(now);
      this.timestamps.set(key, filtered);
      return true;
    }

    return false;
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.timestamps.delete(key);
  }

  /**
   * Clear all rate limits
   */
  resetAll(): void {
    this.timestamps.clear();
  }
}

/**
 * Export singleton rate limiter
 * Default: 10 requests per second per user
 */
export const rateLimiter = new RateLimiter(10, 1000);
